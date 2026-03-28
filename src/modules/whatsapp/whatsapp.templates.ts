import type {
  WantedPersonResult,
  MissingPersonResult,
  BackgroundCheckResult,
  VehicleResult,
  WhapiListMessage,
} from './whatsapp.interfaces';

// ─── Helpers ──────────────────────────────────────────────

export function getTimeBasedGreeting(name: string): string {
  const hour = new Date().getHours();

  const morningGreetings = [
    `Good morning, ${name}! Hope your morning is going well.`,
    `Good morning, ${name}! Hope you're having a bright start to your day.`,
    `Good morning, ${name}! Trust you're having a wonderful morning.`,
    `Good morning, ${name}! Hope your day is off to a great start.`,
    `Good morning, ${name}! Wishing you a productive and blessed morning.`,
  ];

  const afternoonGreetings = [
    `Good afternoon, ${name}! Hope you're having a wonderful day.`,
    `Good afternoon, ${name}! Hope your afternoon is treating you well.`,
    `Good afternoon, ${name}! Trust your day is going smoothly.`,
    `Good afternoon, ${name}! Hope you're having a productive afternoon.`,
    `Good afternoon, ${name}! Wishing you a pleasant rest of your day.`,
  ];

  const eveningGreetings = [
    `Good evening, ${name}! Hope your evening is treating you kindly.`,
    `Good evening, ${name}! Hope you're winding down nicely.`,
    `Good evening, ${name}! Trust you've had a wonderful day.`,
    `Good evening, ${name}! Hope you're having a relaxing evening.`,
    `Good evening, ${name}! Wishing you a peaceful end to your day.`,
  ];

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (hour < 12) return pick(morningGreetings);
  if (hour < 17) return pick(afternoonGreetings);
  return pick(eveningGreetings);
}

// ─── Main Menu (Interactive List) ─────────────────────────

export function mainMenuTemplate(name: string, phone: string): WhapiListMessage {
  const greeting = getTimeBasedGreeting(name);

  return {
    to: phone.includes('@') ? phone : `${phone}@s.whatsapp.net`,
    type: 'list',
    header: { type: 'text', text: '🔍 OpenJustice Field Tools' },
    body: { text: `${greeting}\n\nSelect a check type below:` },
    footer: { text: 'Sierra Leone Police - OpenJustice' },
    action: {
      list: {
        label: 'Select Check Type',
        sections: [
        {
          title: 'Person Checks',
          rows: [
            {
              id: 'wanted',
              title: '🚨 Wanted Person',
              description: 'Check if person has active warrant',
            },
            {
              id: 'missing',
              title: '🔎 Missing Person',
              description: 'Check missing person alerts',
            },
            {
              id: 'background',
              title: '📋 Background Check',
              description: 'Full criminal record check',
            },
          ],
        },
        {
          title: 'Other Checks',
          rows: [
            {
              id: 'vehicle',
              title: '🚗 Vehicle Check',
              description: 'Check stolen vehicle status',
            },
          ],
        },
        {
          title: 'System',
          rows: [
            {
              id: 'help',
              title: '❓ Help & Guide',
              description: 'Learn how to use OpenJustice Field Tools',
            },
          ],
        },
      ],
      },
    },
  };
}

// ─── Authentication ───────────────────────────────────────

export function authBadgePromptTemplate(): string {
  return `🔐 *Authentication Required*\n━━━━━━━━━━━━━━━━━━━━\n\nYour phone is not registered.\nPlease enter your *badge number* to authenticate:`;
}

export function authSuccessTemplate(name: string): string {
  return `✅ *Authenticated*\n\nWelcome, *${name}*! You now have access to OpenJustice Field Tools.`;
}

export function authFailTemplate(attemptsLeft: number): string {
  return `❌ *Badge Not Found*\n\nThe badge number you entered was not recognized.\n\n_${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining._`;
}

export function authLockedTemplate(): string {
  return `🔒 *Session Locked*\n━━━━━━━━━━━━━━━━━━━━\n\nToo many failed attempts. Your session has been ended.\n\nPlease try again later or contact your station commander.`;
}

// ─── Search Prompts ───────────────────────────────────────

export function searchPromptTemplate(queryType: string): string {
  const prompts: Record<string, string> = {
    wanted: '🚨 *Wanted Person Check*\n\nEnter the person\'s name or NIN to search:',
    missing: '🔎 *Missing Person Check*\n\nEnter the person\'s name to search:',
    background: '📋 *Background Check*\n\nEnter the National Identification Number (NIN):',
    vehicle: '🚗 *Vehicle Check*\n\nEnter the license plate number:',
  };

  return prompts[queryType] || 'Enter your search term:';
}

// ─── Menu / Selection ─────────────────────────────────────

export function invalidSelectionTemplate(): string {
  return `❌ *Invalid Selection*\n\nPlease pick an option from the menu.\nSend /start to see the menu again.`;
}

// ─── Wanted Person Results ────────────────────────────────

function dangerLevelEmoji(level: string): string {
  switch (level?.toLowerCase()) {
    case 'high':
      return '🔴';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

export function wantedPersonResultsTemplate(results: WantedPersonResult[]): string {
  const header = `⚠️ *WANTED PERSON RESULTS*\n━━━━━━━━━━━━━━━━━━━━\n\n_${results.length} record${results.length !== 1 ? 's' : ''} found_\n`;

  const entries = results.map((r, i) =>
    `\n*${i + 1}. ${r.name}*\n` +
    `⚖️ Charges: ${r.charges.length ? r.charges.join(', ') : 'N/A'}\n` +
    `${dangerLevelEmoji(r.dangerLevel)} Danger Level: *${r.dangerLevel.toUpperCase()}*\n` +
    `📍 Last Seen: ${r.lastSeenLocation || 'Unknown'}`,
  );

  return header + entries.join('\n━━━━━━━━━━━━━━━━━━━━') +
    '\n\n━━━━━━━━━━━━━━━━━━━━\n_Exercise caution. Contact dispatch if needed._\n\nSend /start for a new query.';
}

export function wantedPersonNotFoundTemplate(): string {
  return `✅ *No Active Warrants Found*\n\nNo matching wanted person records.\n\nSend /start for a new query.`;
}

// ─── Missing Person Results ───────────────────────────────

export function missingPersonResultsTemplate(results: MissingPersonResult[]): string {
  const header = `⚠️ *MISSING PERSON RESULTS*\n━━━━━━━━━━━━━━━━━━━━\n\n_${results.length} alert${results.length !== 1 ? 's' : ''} found_\n`;

  const entries = results.map((r, i) =>
    `\n*${i + 1}. ${r.personName}*${r.age ? ` (Age: ${r.age})` : ''}\n` +
    `📍 Last Seen: ${r.lastSeenLocation || 'Unknown'}\n` +
    `📞 Contact: ${r.contactPhone}`,
  );

  return header + entries.join('\n━━━━━━━━━━━━━━━━━━━━') +
    '\n\n━━━━━━━━━━━━━━━━━━━━\n_If you spot this person, contact dispatch immediately._\n\nSend /start for a new query.';
}

export function missingPersonNotFoundTemplate(): string {
  return `✅ *No Missing Person Alerts*\n\nNo matching missing person records.\n\nSend /start for a new query.`;
}

// ─── Background Check Results ─────────────────────────────

export function backgroundCheckResultTemplate(
  nin: string,
  person: BackgroundCheckResult | null,
): string {
  if (!person) {
    return `📋 *Background Check*\n━━━━━━━━━━━━━━━━━━━━\n\n🆔 NIN: ${nin}\n✅ *Status: CLEAR*\n\n_No records found in the system._\n\nSend /start for a new query.`;
  }

  const fullName = `${person.firstName} ${person.lastName}`;

  if (person.isWanted) {
    return `📋 *Background Check*\n━━━━━━━━━━━━━━━━━━━━\n\n🆔 NIN: ${nin}\n👤 Name: ${fullName}\n🔴 *Status: WANTED*\nCases: ${person.cases.length}\n\n⚠️ *This person is WANTED.*\n_Exercise extreme caution. Contact dispatch immediately._\n\nSend /start for a new query.`;
  }

  if (person.cases.length > 0) {
    return `📋 *Background Check*\n━━━━━━━━━━━━━━━━━━━━\n\n🆔 NIN: ${nin}\n👤 Name: ${fullName}\n🟡 *Status: RECORD EXISTS*\nCases: ${person.cases.length}\n\n_Visit station for full details._\n\nSend /start for a new query.`;
  }

  return `📋 *Background Check*\n━━━━━━━━━━━━━━━━━━━━\n\n🆔 NIN: ${nin}\n👤 Name: ${fullName}\n✅ *Status: CLEAR*\n\n_No criminal records found._\n\nSend /start for a new query.`;
}

// ─── Vehicle Results ──────────────────────────────────────

export function vehicleResultTemplate(plate: string, vehicle: VehicleResult): string {
  const desc = [vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' ');
  const stolen = vehicle.status === 'stolen';

  let msg = `🚗 *Vehicle Check*\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🔢 Plate: *${vehicle.licensePlate}*\n` +
    `Type: ${vehicle.vehicleType}\n`;

  if (desc) msg += `Details: ${desc}\n`;
  if (vehicle.ownerName) msg += `👤 Owner: ${vehicle.ownerName}\n`;

  msg += `Status: *${vehicle.status.toUpperCase()}*`;

  if (stolen) {
    msg += '\n\n🚨 *ALERT: This vehicle is reported STOLEN!*\n_Contact dispatch immediately._';
  }

  msg += '\n\nSend /start for a new query.';
  return msg;
}

export function vehicleNotFoundTemplate(plate: string): string {
  return `🚗 *Vehicle Check*\n━━━━━━━━━━━━━━━━━━━━\n\n🔢 Plate: *${plate.toUpperCase()}*\n✅ No records found.\n\nSend /start for a new query.`;
}

// ─── Generic / System ─────────────────────────────────────

export function errorTemplate(error?: string): string {
  const detail = error ? `\n\n${error}` : '';
  return `❌ *Error*\n━━━━━━━━━━━━━━━━━━━━${detail}\n\nSomething went wrong. Please send /start to try again.`;
}

export function helpTemplate(): string {
  return `📘 *OpenJustice Field Tools - User Guide*
━━━━━━━━━━━━━━━━━━━━

*🎯 What is OpenJustice Field Tools?*
A secure mobile tool for officers to perform field checks via WhatsApp.

*🔍 Available Checks:*

*1. 🚨 Wanted Person Check*
   • Search by name or NIN
   • Shows active warrants
   • Displays danger level & charges

*2. 🔎 Missing Person Check*
   • Search by name
   • View last known location
   • Contact information

*3. 📋 Background Check*
   • Full criminal record search
   • Requires NIN
   • Shows complete case history

*4. 🚗 Vehicle Check*
   • Search by license plate
   • Check stolen vehicle status
   • View vehicle owner info

━━━━━━━━━━━━━━━━━━━━

*🔐 Security:*
• Badge number required for authentication
• 3 failed attempts = session locked
• Sessions expire after 4 hours
• All queries are logged & audited

*📝 How to Use:*
1️⃣ Send /start to open the menu
2️⃣ Select a check type
3️⃣ Enter your search term
4️⃣ View results instantly

*⌨️ Commands:*
• */start* - Open main menu
• */cancel* - Cancel current query
• */help* - Show this guide

*⚠️ Important Notes:*
✓ Only use for official duties
✓ Maintain confidentiality
✓ Report issues to station commander

━━━━━━━━━━━━━━━━━━━━
_Sierra Leone Police - OpenJustice_
_Protecting & Serving with Technology_

Send /start to return to the main menu.`;
}

export function goodbyeTemplate(name: string): string {
  return `👋 Goodbye, ${name}!\n\nYour session has been closed. You can start a new query anytime by sending /start.\n\n_Stay safe out there._\n\n━━━━━━━━━━━━━━━━━━━━\nSierra Leone Police - OpenJustice`;
}

export function restartTemplate(): string {
  return `🔄 *Session Restarted*\n\nYour session has been reset. Let's start fresh!\n\nSend /start to open the menu.`;
}

export function cancelTemplate(): string {
  return `✅ *Query Cancelled*\n\nYour current query has been cancelled.\n\nSend /start to return to the main menu.`;
}
