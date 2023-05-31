# Doctolib Appointment Finder

The Doctolib Appointment Finder is a Node.js application which checks for available appointments for a specific doctor on Doctolib and notifies you via a Slack message if there's an available appointment within a given timespan.

## Setup

1. Clone the repository: `git clone git@github.com:renekann/doctolib-appointment-finder.git`.
2. Install dependencies: `yarn install`.
3. Copy `.env.example` to `.env` and set your environment variables.

## Run it locally
```
yarn start
```

## Run in docker
1. Build the Docker image: `docker build -t doctolib-appointment-finder .`
2. Run the Docker image: `docker run -p 3000:3000 doctolib-appointment-finder`.


## Configuration

The configuration is done using environment variables, which can be set in the `.env` file. The following variables are required:

- `APPOINTMENT_URL`: URL of the doctor's appointment availabilities. This can be extracted from the doctor's booking page.
- `TIMESPAN_DAYS`: The timespan in days within which an appointment should be searched for.
- `SCHEDULE`: A cron expression that defines how often the availability of appointments should be checked.
- `SLACK_WEBHOOK_URL`: The URL of your Slack incoming webhook. This will be used to send notifications.
- `DOCTOR_BOOKING_URL`: The URL of the doctor's booking page. This is optional, but can be used to provide a direct booking link in the Slack notification.

## Extracting the APPOINTMENT_URL

To extract the `APPOINTMENT_URL` from the doctor's booking page, follow these steps:

1. Open the doctor's booking page in your web browser.
2. Open the Developer Tools (typically `F12` or `Ctrl + Shift + I`).
3. Go to the Network tab.
4. Reload the page.
5. In the filter box, type `availabilities.json`.
6. Click on the `availabilities.json` request in the list.
7. Copy the Request URL. This is your `APPOINTMENT_URL`.