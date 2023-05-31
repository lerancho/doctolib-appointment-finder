import axios from 'axios';
import moment from 'moment';
import { URL } from 'url';
import dotenv from 'dotenv';
import cron, {ScheduledTask} from 'node-cron';

dotenv.config();

interface Availability {
  date: string;
  slots: string[];
  substitution: any;
  appointment_request_slots: any[];
}

async function fetchAvailabilities(): Promise<string[]> {
  try {
    // Get the URL from the environment variable
    const url = process.env.APPOINTMENT_URL || '';

    // Check if the URL is defined
    if (!url) {
      throw new Error('The APPOINTMENT_URL environment variable is not defined.');
    }

    // Check if the URL is valid
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error('The APPOINTMENT_URL environment variable is not a valid URL.');
    }

    console.log(`Fetching availabilities for ${url}`);

    // Fetch the availabilities.json
    const response = await axios.get<{availabilities: Availability[]}>(parsedUrl.toString());
    const availabilities = response.data.availabilities;

    // Collect all the dates with available slots
    const availableDates: string[] = [];
    for (const availability of availabilities) {
      if (availability.slots.length > 0) {
        // Parse the date using moment
        const date = moment(availability.date).format('YYYY-MM-DD');
        availableDates.push(date);
      }
    }

    console.log('Fetch complete.');

    // Return the list of available dates
    return availableDates;
  } catch (error) {
    console.error(`Error fetching availabilities: ${error}`);
    return [];
  }
}

async function availableAppointment(dates: string[]): Promise<string> {
  // Get the timespan from the environment variable
  const timespan = Number(process.env.TIMESPAN_DAYS || '0');

  // Check if the timespan is a valid number
  if (isNaN(timespan)) {
    throw new Error('The TIMESPAN_DAYS environment variable is not a valid number.');
  }

  console.log('Checking for available appointments...');

  // Get the current date and the date after the given timespan
  const now = moment();
  const futureDate = moment().add(timespan, 'days');

  // Sort the dates array
  dates.sort();

  // Check if there's a date within the timespan
  for (const date of dates) {
    const appointmentDate = moment(date);
    if (appointmentDate.isBetween(now, futureDate, 'day', '[]')) {
      console.log(`Found an available appointment on ${date}.`);
      return date;
    }
  }

  console.log('No available appointments found.');

  return '';
}

async function fetchQuote(): Promise<string> {
  try {
    const response = await axios.get('https://type.fit/api/quotes');
    const quotes = response.data;
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    return randomQuote.text + ' - ' + randomQuote.author;
  } catch (error) {
    console.error(`Error fetching quote: ${error}`);
    return '';
  }
}

async function sendSlackNotification(date: string): Promise<void> {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const bookingUrl = process.env.DOCTOR_BOOKING_URL;

  if (!slackWebhookUrl) {
    throw new Error('The SLACK_WEBHOOK_URL environment variable is not defined.');
  }

  if (!bookingUrl) {
    throw new Error('The DOCTOR_BOOKING_URL environment variable is not defined.');
  }

  const quote = await fetchQuote();

  const message = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:pill: *Quote of the day:* _${quote}_`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `An appointment is available on *${date}* :calendar:. You can book it here: ${bookingUrl}`
        }
      },
    ]
  };

  await axios.post(slackWebhookUrl, message);
}

// Usage
let task: ScheduledTask;

async function checkAppointmentAvailability() {
  const dates = await fetchAvailabilities();
  const date = await availableAppointment(dates);

  if (date) {
    console.log(`Next available appointment is on: ${date}`);
    await sendSlackNotification(date);

    // Stop the task once an appointment is found
    if (task) {
      console.log('Appointment found. Stopping the task...');
      task.stop();
    }
  } else {
    console.log('No appointments available within the specified timespan.');
  }
}

// Get the schedule from the environment variable
const schedule = process.env.SCHEDULE || '* * * * *';

// Schedule the function using node-cron
if (!cron.validate(schedule)) {
  console.error('The SCHEDULE environment variable is not a valid cron expression.');
} else {
  console.log(`Scheduling appointment availability check every ${schedule}.`);
  task = cron.schedule(schedule, checkAppointmentAvailability);
}