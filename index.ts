import axios from 'axios';
import moment from 'moment';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Fichier pour stocker les disponibilités précédentes
const STATE_FILE = 'last_availabilities.json';

// Récupération des rendez-vous
async function fetchAvailabilities(): Promise<string[]> {
  const url = process.env.APPOINTMENT_URL;
  if (!url) throw new Error('APPOINTMENT_URL not set.');

  const today = moment().format('YYYY-MM-DD');
  const fullUrl = url.replace(/start_date=\d{4}-\d{2}-\d{2}/, `start_date=${today}`);

  console.log(`Fetching availabilities from: ${fullUrl}`);

  const response = await axios.get<{ next_slot: string; availabilities?: any[] }>(fullUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://www.doctolib.fr/',
    },
  });

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

// Chargement des rendez-vous précédents
function loadPreviousAvailabilities(): string[] {
  if (!fs.existsSync(STATE_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Sauvegarde des rendez-vous
function saveAvailabilities(dates: string[]): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(dates, null, 2));
}

// Comparaison entre anciens et nouveaux rendez-vous
function compareAvailabilities(oldDates: string[], newDates: string[]) {
  const added = newDates.filter(d => !oldDates
