import axios from 'axios';
import moment from 'moment';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const STATE_FILE = 'last_availabilities.json';

async function fetchAvailabilities(): Promise<string[]> {
  const url = process.env.APPOINTMENT_URL;
  if (!url) throw new Error('APPOINTMENT_URL not set.');

  const today = moment().format('YYYY-MM-DD');
  const fullUrl = url.replace(/start_date=\d{4}-\d{2}-\d{2}/, `start_date=${today}`);

  console.log(`Fetching availabilities from: ${fullUrl}`);

  const response = await axios.get<{ next_slot: string; availabilities?: any[] }>(fullUrl);
  const availabilities = new Set<string>();

  if (response.data.availabilities) {
    for (const day of response.data.availabilities) {
      if (day.slots && day.slots.length > 0) {
        availabilities.add(moment(day.date).format('YYYY-MM-DD'));
      }
    }
  } else if (response.data.next_slot) {
    availabilities.add(moment(response.data.next_slot).format('YYYY-MM-DD'));
  }

  return Array.from(availabilities).sort();
}

function loadPreviousAvailabilities(): string[] {
  if (!fs.existsSync(STATE_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveAvailabilities(dates: string[]): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(dates, null, 2));
}

function compareAvailabilities(oldDates: string[], newDates: string[]) {
  const added = newDates.filter(d => !oldDates.includes(d));
  const removed = oldDates.filter(d => !newDates.includes(d));
  return { added, removed };
}

(async () => {
  try {
    const previous = loadPreviousAvailabilities();
    const current = await fetchAvailabilities();

    const { added, removed } = compareAvailabilities(previous, current);

    if (added.length > 0 || removed.length > 0) {
      console.log('📅 Changes detected!');
      if (added.length > 0) console.log(`➕ New appointments: ${added.join(', ')}`);
      if (removed.length > 0) console.log(`➖ Removed appointments: ${removed.join(', ')}`);
    } else {
      console.log('✅ No changes in available appointments.');
    }

    saveAvailabilities(current);
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();
