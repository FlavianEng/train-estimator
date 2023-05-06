import {
    ApiException,
    DiscountCard,
    InvalidTripInputException,
    Passenger,
    TripDetails,
    TripRequest
} from "./model/trip.request";

export class TrainTicketEstimator {
    private readonly baseApiUrl = 'https://sncf.com/api/train/estimate/price';
    private readonly childPrice = 9;

    async estimate(tripRequest: TripRequest): Promise<number> {
        this.validateTripRequest(tripRequest);

        const sncfPrice = await this.getSncfPrice(tripRequest.details.from, tripRequest.details.to, tripRequest.details.when);
        const passengers = tripRequest.passengers;

        let total = 0;

        total = this.definePriceDependingAgeAndDate(total, sncfPrice, tripRequest, passengers);
        total = this.applyDiscountCards(total, sncfPrice, passengers);

        return total;
    }

    private validateTripRequest(tripRequest: TripRequest) {
        if (!tripRequest.passengers.length) {
            return 0;
        }

        if (tripRequest.passengers.some((passenger) => passenger.age < 0)) {
            throw new InvalidTripInputException("Age is invalid");
        }

        if (!tripRequest.details.from.trim().length) {
            throw new InvalidTripInputException("Start city is invalid");
        }

        if (!tripRequest.details.to.trim().length) {
            throw new InvalidTripInputException("Destination city is invalid");
        }

        if (tripRequest.details.when < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDay(), 0, 0, 0)) {
            throw new InvalidTripInputException("Date is invalid");
        }
    }

    private async getSncfPrice(from: TripDetails['from'], to: TripDetails['to'], when: TripDetails['when']) {
        const sncfPrice = (await (await fetch(`${this.baseApiUrl}?from=${from}&to=${to}&date=${when}`)).json())?.price || -1;

        if (sncfPrice === -1) {
            throw new ApiException();
        }

        return sncfPrice;
    }

    private applyDatePriceModifier(temporaryPrice: number, sncfPrice: number, tripRequest: TripRequest) {
        const dayInMilliseconds = 1000 * 3600 * 24;
        const currentDate = new Date();
        const earlyPurchaseDate = currentDate.setDate(currentDate.getDate() + 30);
        const risePeriodPurchaseDate = currentDate.setDate(currentDate.getDate() - 25);
        const lastHoursPurchaseDate = new Date().setHours(new Date().getHours() + 6);

        if (tripRequest.details.when.getTime() >= earlyPurchaseDate || tripRequest.details.when.getTime() <= lastHoursPurchaseDate) {
            temporaryPrice -= sncfPrice * 0.2;

            return temporaryPrice;
        }


        if (tripRequest.details.when.getTime() > risePeriodPurchaseDate) {
            const dateBeforeDepartureInTime = Math.abs(tripRequest.details.when.getTime() - new Date().getTime());
            const dateBeforeDepartureInDays = Math.ceil(dateBeforeDepartureInTime / dayInMilliseconds);

            const sncfPriceRise = 0.02 * sncfPrice;

            const risePeriodBeforeDeparture = 20;
            const risePeriodModifier = risePeriodBeforeDeparture - dateBeforeDepartureInDays;

            temporaryPrice += risePeriodModifier * sncfPriceRise;

            return temporaryPrice;
        }

        temporaryPrice += sncfPrice;
        return temporaryPrice;
    }

    private applyAgePriceModifier(temporaryPrice: number, sncfPrice: number, passenger: Passenger) {
        if (passenger.age <= 17) {
            temporaryPrice = sncfPrice * 0.6;
            return temporaryPrice;
        }

        if (passenger.age >= 70) {
            temporaryPrice = sncfPrice * 0.8;

            if (passenger.discounts.includes(DiscountCard.Senior)) {
                temporaryPrice -= sncfPrice * 0.2;
            }
            return temporaryPrice;
        }


        temporaryPrice = sncfPrice * 1.2;
        return temporaryPrice;
    }

    private hasFixedPrice(passenger: Passenger) {
        return passenger.age < 4 || passenger.discounts.includes(DiscountCard.TrainStroke)
    }

    private definePriceDependingAgeAndDate(total: number, sncfPrice: number, tripRequest: TripRequest, passengers: Passenger[]) {
        let temporaryPrice = sncfPrice;

        for (let i = 0; i < passengers.length; i++) {
            if (this.hasFixedPrice(passengers[i])) {
                if (passengers[i].age < 1) {
                    continue;
                }

                if (passengers[i].age > 0 && passengers[i].age < 4) {
                    temporaryPrice = this.childPrice;
                }

                if (passengers[i].discounts.includes(DiscountCard.TrainStroke)) {
                    temporaryPrice = 1;
                }

                total += temporaryPrice;
                continue;
            }

            temporaryPrice = this.applyAgePriceModifier(temporaryPrice, sncfPrice, passengers[i]);
            temporaryPrice = this.applyDatePriceModifier(temporaryPrice, sncfPrice, tripRequest);

            total += temporaryPrice;
        }

        return total;
    }

    private applyDiscountCards(total: number, sncfPrice: number, passengers: Passenger[]) {
        if (passengers.some((passenger) => passenger.discounts.includes(DiscountCard.Family))) {
            const familyLastNames = [...new Set(passengers.filter((passenger) => passenger.lastName && passenger.discounts.includes(DiscountCard.Family)).map((passenger) => passenger.lastName))];
            const familyPassengers = passengers.filter((passenger) => passenger.age > 1 && familyLastNames.includes(passenger.lastName) && !passenger.discounts.includes(DiscountCard.TrainStroke));
            
            for (let i = 0; i < familyPassengers.length; i++) {
                const passenger = familyPassengers[i];
                if (passenger.age >= 70 && passenger.discounts.includes(DiscountCard.Senior)) {
                    total += sncfPrice * 0.2;
                }
                if (passenger.age > 0 && passenger.age < 4) {
                    total -= this.childPrice * 0.3;
                }
                if (passenger.age >= 4) {
                    total -= sncfPrice * 0.3;
                }
            }
    
            return total;
        }
    
        const isMinor = passengers.some((passenger) => passenger.age < 18)

        if (passengers.length == 2) {
            const isCouple = passengers.some((passenger) =>
                passenger.discounts.includes(DiscountCard.Couple)
            );

            if (isCouple && !isMinor) {
                total -= sncfPrice * 0.2 * 2;
            }
        }

        if (passengers.length == 1) {
            const isCouple = passengers.some((passenger) =>
                passenger.discounts.includes(DiscountCard.HalfCouple)
            );

            if (isCouple && !isMinor) {
                total -= sncfPrice * 0.1;
            }
        }

        return total;
    }
}