import axios from 'axios';
import moment from 'moment';
import {fetchAvailabilities, availableAppointment, sendSlackNotification} from './index';

jest.mock('axios');

// Mock the environment variables
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  // Store the original environment variables
  originalEnv = { ...process.env };

  // Override environment variables for test
  process.env.APPOINTMENT_URL = 'http://test.com/availabilities.json?start_date=2020-01-01';
  process.env.TIMESPAN_DAYS = '7';
  process.env.SCHEDULE = '* * * * *';
  process.env.SLACK_WEBHOOK_URL = 'http://test.com/slack-webhook-url';
  process.env.DOCTOR_BOOKING_URL = 'http://test.com/doctor-booking-url';
});

afterEach(() => {
  // Restore the original environment variables
  process.env = originalEnv;
});

describe("fetchAvailabilities", () => {
  test("Fetches availabilities from API and returns available dates", async () => {
    // setup
    const expectedDate = moment().add(1, 'days').format('YYYY-MM-DD');
    const url = 'http://test.com/availabilities.json?start_date=2020-01-01';

    (axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
      data: { next_slot: expectedDate }
    });

    const today = moment().format('YYYY-MM-DD');
    const replacedUrl = url.replace(/start_date=\d{4}-\d{2}-\d{2}/, `start_date=${today}`);

    // work
    const dates = await fetchAvailabilities();

    // expect
    expect(dates).toEqual([expectedDate]);
    expect(axios.get).toHaveBeenCalledWith(replacedUrl);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

describe("availableAppointment", () => {
  test("Checks available dates and returns an appointment within timespan", async () => {
    // setup
    const now = moment().format('YYYY-MM-DD');
    const futureDate = moment().add(3, 'days').format('YYYY-MM-DD');
    const dates = [now, futureDate];

    // work
    const date = await availableAppointment(dates, 3);

    // expect
    expect(date).toEqual(now);
  });

  test("Returns empty string when no appointments are available", async () => {
    // setup
    const futureDate = moment().add(5, 'days').format('YYYY-MM-DD');
    const dates = [futureDate];

    // work
    const date = await availableAppointment(dates, 3);

    // expect
    expect(date).toEqual('');
  });
});

describe("sendSlackNotification", () => {
  test("Sends a notification to Slack", async () => {
    // setup
    const date = moment().format('YYYY-MM-DD');
    const message = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:pill: An appointment is available on *${date}* :calendar:. You can book it here: http://test.com/doctor-booking-url`
          }
        },
      ]
    };

    // work
    await sendSlackNotification(date);

    // expect
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith('http://test.com/slack-webhook-url', message);
  });
});
