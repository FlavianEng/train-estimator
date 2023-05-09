import {
  ApiException,
  DiscountCard,
  InvalidTripInputException,
  Passenger,
  TripDetails,
  TripRequest,
} from './model/trip.request';
import {TrainTicketEstimator} from './train-estimator';

describe('train estimator', function () {
    const thirtyOneDaysBeforeDate = new Date(
        new Date().setDate(new Date().getDate() + 31)
    );
    const sixDaysBeforeDate = new Date(
        new Date().setDate(new Date().getDate() + 6)
    );
    const fiveDaysBeforeDate = new Date(
        new Date().setDate(new Date().getDate() + 5)
    );
    const sevenHoursBeforeDate = new Date(
        new Date().setHours(new Date().getHours() + 7)
    );
    const sixHoursBeforeDate = new Date(
        new Date().setHours(new Date().getHours() + 6)
    );

    let dummyPassenger: Passenger;
    let validTripDetails: TripDetails;
    let service: TrainTicketEstimator;
    let mockedPrice: number;

    beforeEach(() => {
        mockedPrice = 20;
        dummyPassenger = new Passenger(28, []);
        validTripDetails = new TripDetails(
            'Bordeaux',
            'Paris',
            thirtyOneDaysBeforeDate
        );

        service = new TrainTicketEstimator();

        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({price: mockedPrice}),
            })
        ) as jest.Mock;
    });

    afterEach(() => {
        (global.fetch as jest.Mock).mockRestore();
    });

    describe('estimate', () => {
        it('should return 0 when there is no passengers', async () => {
            const tripDetails = new TripDetails(
                'Bordeaux',
                'Paris',
                thirtyOneDaysBeforeDate
            );
            const tripRequest = new TripRequest(tripDetails, []);

            await expect(service.estimate(tripRequest)).resolves.toEqual(0);
        });

        it('should throw because start city is empty', async () => {
            const tripDetails = new TripDetails('', 'Paris', thirtyOneDaysBeforeDate);
            const tripRequest = new TripRequest(tripDetails, [dummyPassenger]);
            await expect(
                async () => await service.estimate(tripRequest)
            ).rejects.toThrowError(
                new InvalidTripInputException('Start city is invalid')
            );
        });

        it('should throw because destination city is empty', async () => {
            const tripDetails = new TripDetails(
                'Bordeaux',
                '',
                thirtyOneDaysBeforeDate
            );
            const tripRequest = new TripRequest(tripDetails, [dummyPassenger]);

            await expect(
                async () => await service.estimate(tripRequest)
            ).rejects.toThrowError(
                new InvalidTripInputException('Destination city is invalid')
            );
        });

        it('should throw because date is invalid', async () => {
            const tripDetails = new TripDetails(
                'Bordeaux',
                'Paris',
                new Date('2022/06/06')
            );
            const tripRequest = new TripRequest(tripDetails, [dummyPassenger]);

            await expect(
                async () => await service.estimate(tripRequest)
            ).rejects.toThrowError(new InvalidTripInputException('Date is invalid'));
        });

        it('should throw ApiException when the API call fails', async () => {
            mockedPrice = -1;
            const tripRequest = new TripRequest(validTripDetails, [dummyPassenger]);

            await expect(
                async () => await service.estimate(tripRequest)
            ).rejects.toThrowError(ApiException);
        });

        it('should throw because passager age is less than 0', async () => {
            const invalidPassenger = new Passenger(-2, []);
            const tripRequest = new TripRequest(validTripDetails, [invalidPassenger]);

            await expect(
                async () => await service.estimate(tripRequest)
            ).rejects.toThrowError(new InvalidTripInputException('Age is invalid'));
        });

        it('should have a 100% discount if passenger is strictly less than 1 yo', async () => {
            const passenger = new Passenger(0.6, []);
            const tripRequest = new TripRequest(validTripDetails, [passenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(0);
        });

        it('should have a 40% discount if passenger is less or equal than 17 yo', async () => {
            const passenger = new Passenger(17, []);
            const tripRequest = new TripRequest(validTripDetails, [passenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(8);
        });

        it('should have a 20% discount if passenger is more or equal than 70 yo but no discount card', async () => {
            const passenger = new Passenger(75, []);
            const tripRequest = new TripRequest(validTripDetails, [passenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(12);
        });

        it('should have a 40% discount if passenger is more or equal than 70 yo and has a Senior discount card', async () => {
            const passenger = new Passenger(75, [DiscountCard.Senior]);
            const tripRequest = new TripRequest(validTripDetails, [passenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(8);
        });

        it('should have a 0% discount if passenger is older than 17 yo and younger than 70', async () => {
            const tripRequest = new TripRequest(validTripDetails, [dummyPassenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(20);
        });

        it('should have a 20% discount if the ticket is bought thirty days before departure', async () => {
            const tripRequest = new TripRequest(validTripDetails, [dummyPassenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(20);
        });

        it('should have a 20% discount if the ticket is bought 6 hours before departure', async () => {
            const tripDetails = new TripDetails(
                'Bordeaux',
                'Paris',
                sixHoursBeforeDate
            );
            const tripRequest = new TripRequest(tripDetails, [dummyPassenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(20);
        });

        it('should increase by 100% discount if the ticket is bought 7 hours before departure', async () => {
            const tripDetails = new TripDetails(
                'Bordeaux',
                'Paris',
                sevenHoursBeforeDate
            );
            const tripRequest = new TripRequest(tripDetails, [dummyPassenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(44);
        });

        it('should increase by 30% if the ticket is bought five days before departure', async () => {
            const tripDetails = new TripDetails(
                'Bordeaux',
                'Paris',
                sixDaysBeforeDate
            );
            const tripRequest = new TripRequest(tripDetails, [dummyPassenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(29.6);
        });

        it('should increase by 100% if the ticket is bought four days before departure', async () => {
            const tripDetails = new TripDetails(
                'Bordeaux',
                'Paris',
                fiveDaysBeforeDate
            );
            const tripRequest = new TripRequest(tripDetails, [dummyPassenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(44);
        });

        it('should have a fixed ticket price if passenger is strictly less than 4 yo', async () => {
            const passenger = new Passenger(3, []);
            const tripRequest = new TripRequest(validTripDetails, [passenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(9);
        });

        it('should have a fixed ticket price if passenger is an employee', async () => {
            const passenger = new Passenger(42, [DiscountCard.TrainStroke]);
            const tripRequest = new TripRequest(validTripDetails, [passenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(1);
        });

        it('should apply the couple discount', async () => {
            const passengerWithCoupleDiscount = new Passenger(28, [
                DiscountCard.Couple,
            ]);
            const tripRequest = new TripRequest(validTripDetails, [
                dummyPassenger,
                passengerWithCoupleDiscount,
            ]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(32);
        });

        it('should apply the family discount', async () => {
            const passengerWithCoupleDiscount = new Passenger(28, [
                DiscountCard.Couple,
            ]);
            const tripRequest = new TripRequest(validTripDetails, [
                dummyPassenger,
                passengerWithCoupleDiscount,
            ]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(32);
        });

        it("should not apply the couple discount because passengers doesn't have Couple discount", async () => {
            const tripRequest = new TripRequest(validTripDetails, [
                dummyPassenger,
                dummyPassenger,
            ]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(40);
        });

        it('should have 2 passengers a couple because one of passengers is strictly less than 18 yo', async () => {
            const passengerWithCoupleDiscount = new Passenger(17, [
                DiscountCard.Couple,
            ]);
            const tripRequest = new TripRequest(validTripDetails, [
                dummyPassenger,
                passengerWithCoupleDiscount,
            ]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(28);
        });

        it('should have a 10% discount on total price if passenger is an adult and has a HalfCouple discount card', async () => {
            const passenger = new Passenger(28, [DiscountCard.HalfCouple]);
            const tripRequest = new TripRequest(validTripDetails, [passenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(18);
        });

        it("shouldn't have a 10% discount on total price if passenger is an adult and hasn't a HalfCouple discount card", async () => {
            const passenger = new Passenger(28, []);
            const tripRequest = new TripRequest(validTripDetails, [passenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(20);
        });

        it("shouldn't have a 10% discount on total price if passenger isn't an adult and has a HalfCouple discount card", async () => {
            const passenger = new Passenger(17, [DiscountCard.HalfCouple]);
            const tripRequest = new TripRequest(validTripDetails, [passenger]);

            await expect(service.estimate(tripRequest)).resolves.toEqual(8);
        });

        it('should have a 30% family discount on total price', function () {
            const passengers = [
                new Passenger(28, [DiscountCard.Family], 'Dupont'),
                new Passenger(25, [], 'Dupont'),
            ];
            const tripRequest = new TripRequest(validTripDetails, passengers);
            expect(service.estimate(tripRequest)).resolves.toEqual(28);
        });

        it('should have a 30% family discount for each family', function () {
            const passengers = [
                new Passenger(28, [DiscountCard.Family], 'Dupont'),
                new Passenger(25, [], 'Dupont'),
                new Passenger(37, [DiscountCard.Family], 'Martin'),
                new Passenger(2, [], 'Martin'),
                dummyPassenger,
            ];
            const tripRequest = new TripRequest(validTripDetails, passengers);
            expect(service.estimate(tripRequest)).resolves.toEqual(71);
        });

        it('should have a 12.5% family discount on total price', function () {
            const passengers = [
                new Passenger(76, [DiscountCard.Family], 'Dupont'),
                new Passenger(2, [], 'Martin'),
                dummyPassenger,
            ];
            const tripRequest = new TripRequest(validTripDetails, passengers);
            expect(service.estimate(tripRequest)).resolves.toEqual(35);
        });

        it('should have a 70% discount on total price (senior + family + date)', function () {
            const passengers = [
                new Passenger(73, [DiscountCard.Senior, DiscountCard.Family], 'Dupont'),
                new Passenger(70, [DiscountCard.Senior], 'Dupont'),
            ];
            const tripRequest = new TripRequest(validTripDetails, passengers);
            expect(service.estimate(tripRequest)).resolves.toEqual(12);
        });

        it('should have a 50% discount on total price', function () {
            const passengers = [
                new Passenger(73, [DiscountCard.Senior, DiscountCard.Family], 'Dupont'),
                new Passenger(69, [], 'Dupont'),
            ];
            const tripRequest = new TripRequest(validTripDetails, passengers);
            expect(service.estimate(tripRequest)).resolves.toEqual(20);
        });

        it('should have a 30% family discount for the first passenger ', function () {
            const passengers = [
                new Passenger(28, [DiscountCard.Family], 'Dupont'),
                new Passenger(25, [], 'Martin'),
            ];
            const tripRequest = new TripRequest(validTripDetails, passengers);
            expect(service.estimate(tripRequest)).resolves.toEqual(34);
        });

        it('should have a 30% family discount for the second passenger', function () {
            const passengers = [
                new Passenger(
                    28,
                    [DiscountCard.Family, DiscountCard.TrainStroke],
                    'Dupont'
                ),
                new Passenger(25, [], 'Dupont'),
            ];
            const tripRequest = new TripRequest(validTripDetails, passengers);
            expect(service.estimate(tripRequest)).resolves.toEqual(15);
        });
    });
});
