import {ApiException, DiscountCard, InvalidTripInputException, TripDetails, TripRequest} from "./model/trip.request";

export class TrainTicketEstimator {
    private readonly baseApiUrl = 'https://sncf.com/api/train/estimate/price';

    async estimate(tripRequest: TripRequest): Promise<number> {
        this.validateTripRequest(tripRequest);

        const sncfPrice = await this.getSncfPrice(tripRequest.details.from, tripRequest.details.to, tripRequest.details.when);
        const passengers = tripRequest.passengers;

        let total = 0;
        let temporaryPrice = sncfPrice;

        for (let i = 0; i < passengers.length; i++) {

            if (passengers[i].age < 1) {
                continue;
            }

            // Seniors
            else if (passengers[i].age <= 17) {
                temporaryPrice = sncfPrice * 0.6;
            } else if (passengers[i].age >= 70) {
                temporaryPrice = sncfPrice * 0.8;
                if (passengers[i].discounts.includes(DiscountCard.Senior)) {
                    temporaryPrice -= sncfPrice * 0.2;
                }
            } else {
                temporaryPrice = sncfPrice * 1.2;
            }

            temporaryPrice = this.applyDatePriceModifier(temporaryPrice, sncfPrice, tripRequest);

            if (passengers[i].age > 0 && passengers[i].age < 4) {
                temporaryPrice = 9;
            }

            if (passengers[i].discounts.includes(DiscountCard.TrainStroke)) {
                temporaryPrice = 1;
            }

            total += temporaryPrice;
            temporaryPrice = sncfPrice;
        }

        if (passengers.length == 2) {
            let cp = false;
            let mn = false;
            for (let i = 0; i < passengers.length; i++) {
                if (passengers[i].discounts.includes(DiscountCard.Couple)) {
                    cp = true;
                }
                if (passengers[i].age < 18) {
                    mn = true;
                }
            }
            if (cp && !mn) {
                total -= sncfPrice * 0.2 * 2;
            }
        }

        if (passengers.length == 1) {
            let cp = false;
            let mn = false;
            for (let i = 0; i < passengers.length; i++) {
                if (passengers[i].discounts.includes(DiscountCard.HalfCouple)) {
                    cp = true;
                }
                if (passengers[i].age < 18) {
                    mn = true;
                }
            }
            if (cp && !mn) {
                total -= sncfPrice * 0.1;
            }
        }

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

        if (tripRequest.details.when.getTime() >= earlyPurchaseDate) {
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
}