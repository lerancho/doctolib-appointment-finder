import axios from 'axios';
import moment from 'moment';
import { URL } from 'url';
import dotenv from 'dotenv';
import cron, { ScheduledTask } from 'node-cron';

dotenv.config();

export async function fetchAvailabilities(): Promise<string[]> {
  try {
    // Get the URL from the environment variable
    let url = process.env.APPOINTMENT_URL || '';

    // Check if the URL is defined
    if (!url) {
      throw new Error('The APPOINTMENT_URL environment variable is not defined.');
    }

    // Replace the start_date with today's date
    const today = moment().format('YYYY-MM-DD');
    url = url.replace(/start_date=\d{4}-\d{2}-\d{2}/, `start_date=${today}`);

    // Check if the URL is valid
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error('The APPOINTMENT_URL environment variable is not a valid URL.');
    }

    console.log(`Fetching availabilities for ${url}`);

    // Fetch the availabilities.json
    const response = await axios.get<{ next_slot: string }>(parsedUrl.toString());

    // Check if next_slot is available
    const nextSlot = response.data.next_slot;
    if (nextSlot) {
      const availableDates = [moment(nextSlot).format('YYYY-MM-DD')];
      console.log('Fetch complete.');
      return availableDates;
    } else {
      console.log('No next_slot available.');
      return [];
    }
  } catch (error) {
    console.error(`Error fetching availabilities: ${error}`);
    return [];
  }
}

export async function availableAppointment(dates: string[], timespan: number): Promise<string> {
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

export async function sendSlackNotification(date: string): Promise<void> {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const bookingUrl = process.env.DOCTOR_BOOKING_URL;

  if (!slackWebhookUrl) {
    throw new Error('The SLACK_WEBHOOK_URL environment variable is not defined.');
  }

  if (!bookingUrl) {
    throw new Error('The DOCTOR_BOOKING_URL environment variable is not defined.');
  }

  const message = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:pill: An appointment is available on *${date}* :calendar:.\nYou can book it here: ${bookingUrl}`,
        },
      },
    ],
  };

  await axios.post(slackWebhookUrl, message);
}

// Usage
let task: ScheduledTask;

async function checkAppointmentAvailability() {
  // Get the timespan from the environment variable
  const timespan = Number(process.env.TIMESPAN_DAYS || '0');
  const stopWhenFound = process.env.STOP_WHEN_FOUND?.toLowerCase() === 'true';

  try {
    const dates = await fetchAvailabilities();
    const date = await availableAppointment(dates, timespan);

    if (date) {
      console.log(`Next available appointment is on: ${date}`);
      await sendSlackNotification(date).catch((error) => {
        console.error(`Error while sending Slack notification: ${error}`);
      });

      // Stop the task once an appointment is found
      if (task && stopWhenFound) {
        console.log('Appointment found.\nStopping the task...');
        task.stop();
      }
    } else {
      console.log(`No appointments available within the specified timespan (${timespan} days).`);
    }
  } catch (error) {
    console.error(`Error while checking appointment availability: ${error}`);
  }
}

export async function sendInitialSlackNotification(): Promise<void> {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const bookingUrl = process.env.DOCTOR_BOOKING_URL;
  const timespan = Number(process.env.TIMESPAN_DAYS || '0');
  const schedule = process.env.SCHEDULE || '* * * * *';

  if (!slackWebhookUrl) {
    throw new Error('The SLACK_WEBHOOK_URL environment variable is not defined.');
  }

  if (!bookingUrl) {
    throw new Error('The DOCTOR_BOOKING_URL environment variable is not defined.');
  }

  const message = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:robot_face: The Doctolib Appointment Finder has started checking every ${schedule} for available appointments within the next ${timespan} days.\nYou will receive notifications when appointments become available.\nThe booking link is: ${bookingUrl}`,
        },
      },
    ],
  };

  await axios.post(slackWebhookUrl, message);
}

(async () => {
  if (typeof jest !== 'undefined') {
    console.log('Running in Jest environment');
    return;
  }

  // Get the schedule from the environment variable
  const schedule = process.env.SCHEDULE || '* * * * *';
  const runOnce = process.env.RUN_ONCE?.toLowerCase() === 'true';
  const sendInitial = process.env.SEND_INITIAL_NOTIFICATION?.toLowerCase() !== 'false';

  if (runOnce) {
    console.log('RUN_ONCE=true detected: running one check and exiting.');
    if (sendInitial) {
      await sendInitialSlackNotification().catch((error) => {
        console.error(`Error while sending initial Slack notification: ${error}`);
      });
    }

    // run a single check and exit — good for scheduled CI runs
    await checkAppointmentAvailability();
    // exit explicitly so that GitHub Actions job ends
    process.exit(0);
  }

  // If not run-once: schedule with node-cron (original behaviour)
  if (!cron.validate(schedule)) {
    console.error('The SCHEDULE environment variable is not a valid cron expression.');
  } else {
    console.log(`Scheduling appointment availability check every ${schedule}.`);
    try {
      task = cron.schedule(schedule, checkAppointmentAvailability);
      // send initial notification if configured
      if (sendInitial) {
        sendInitialSlackNotification().catch((error) => {
          console.error(`Error while sending initial Slack notification: ${error}`);
        });
      }
    } catch (error) {
      console.error(`Error while scheduling appointment availability check: ${error}`);
    }
  }
})();
