import type { HelpTexts } from './types';

// Help texts of screen S1, the start screen.
export const START_HELP = {
  'start.app': {
    what: 'A risk register for the ICT risks of your company. It measures each risk in money. It finds the best portfolio, the best set of response options for your budget.',
    why: 'The app follows the risk steps of NIST. The words on the screens are plain, and each "?" gives the NIST reference.',
    source: 'NIST SP 800-221r1 and NIST IR 8286 Rev. 1.',
  },
  'start.documents': {
    what: 'The risk documents that this browser keeps. One document holds your company context, your registers, your risks and your decisions.',
    why: 'Select a document before you open, export or import into it. The table shows when you saved it and when you last made a copy.',
    example: 'A small company usually has one document with one register for the whole company.',
  },
  'start.restore-valid': {
    what: 'Replaces the damaged copy with the newest kept version of the document that passes all checks.',
    why: 'The app does not open or export a damaged copy, because it can hold wrong numbers. Use this button, or import a copy that you exported before.',
  },
  'start.modes': {
    what: 'Guided mode takes you through 9 steps, one task on each page. The other buttons open one screen of the full editor, which shows all fields.',
    why: 'Both modes change the same document. Start with the guided mode. Use the full editor when you need a field that the guided mode does not show.',
    source: 'NIST SP 800-221r1 Sec. 2.2.',
  },
  'start.create': {
    what: 'Makes a new, empty document with one register for your company.',
    why: 'A register is the list of risks that you identify, analyze and respond to. You add the context, the objectives and the budget in the later steps.',
    source: 'NIST SP 800-221r1 Sec. 3.3.5.',
  },
  'start.title': {
    what: 'The name of the new document.',
    why: 'The title shows in the list of documents and in the file name of each export. It also shows on the printed decision record.',
    example: 'Risk register 2027.',
  },
  'start.organization': {
    what: 'The name of your company or of the part of the company that the register covers. You can leave it empty.',
    why: 'The name goes on the printed decision record, so the reader knows which company it is about.',
    example: 'Example Machinery GmbH.',
  },
  'start.currency': {
    what: 'The currency of all amounts in the document, as three capital letters.',
    why: 'Losses, costs and the budget all use this currency. One document holds one currency, so you cannot mix EUR and USD in it.',
    example: 'EUR, USD or GBP.',
  },
  'start.examples': {
    what: 'Opens a filled document, so you can see a finished register. Example 2 is a small company with numbers and a full plan. Example 1 copies the NIST enterprise register and profile, with words only. Example 3 shows registers from other tools, merged into one.',
    why: 'An example is a copy in this browser. You can change it or delete it. Its numbers show how the app works. Do not use them for your own risks.',
    source: 'NIST SP 800-221r1 Fig. 10, Fig. 11, Table 9 and Table 10.',
  },
  'start.import': {
    what: 'Reads a file with risks and shows a preview first. Nothing changes until you click a save button in the preview.',
    why: 'Use it to bring in a register from a spreadsheet or another tool. You can also merge the work of a colleague or restore a copy that you exported.',
    source: 'NIST IR 8286 Rev. 1 for the NIST register and detail records. NIST OSCAL for the POA&M file.',
  },
  'start.open-passphrase': {
    what: 'The passphrase of an encrypted copy that this app made. Leave it empty for all other files.',
    why: 'The app cannot read an encrypted file without its passphrase. The app does not keep the passphrase.',
  },
  'start.import-file': {
    what: 'The file to read. The app finds the format from the content of the file.',
    why: 'A spreadsheet needs a header row with names such as risk, likelihood, impact and owner. The app maps known column names and lists each value that it had to fill in.',
    example: 'A CSV or XLSX file of your current risk list. A JSON file from this app or from the NIST template.',
  },
  'start.import-save': {
    what: 'Add to the document merges the risks of the file into the selected document. Open as its own document keeps the file as a separate document.',
    why: 'A merge keeps your other risks and asks you what to do with each risk that has the same ID. Errors in the preview stop the save, so correct the file first.',
  },
  'start.merge': {
    what: 'The risks and registers of the file that have an ID that the document already uses. The table shows each changed field with its current and incoming value.',
    why: 'Keep current ignores the file for that risk. Take incoming writes the values of the file. Keep both adds the incoming risk with a new ID. The change log records your choice.',
  },
  'start.export': {
    what: 'Saves a copy of the selected document to your downloads, in the format that you select.',
    why: 'A browser can delete stored data without a warning. Export a copy at least once a week and keep it in a safe place.',
  },
  'start.export-native': {
    what: 'The whole document in the file format of this app. It keeps every field and the change log.',
    why: 'This is the backup to keep. Import it here to restore the document, or give it to a colleague who uses the app.',
    source: 'RFC 8785 for the order of the keys.',
  },
  'start.export-ir8286': {
    what: 'Two JSON files in the NIST format. One has the register entries and one has the risk detail records.',
    why: 'Give these files to a tool or a parent organization that reads the NIST format. The app leaves out each risk that has placeholder numbers.',
    source: 'NIST IR 8286 Rev. 1 and NIST SP 800-221r1 App. B.',
  },
  'start.export-csv': {
    what: 'One table with one row for each risk. The NIST columns come first, then the other fields of this app.',
    why: 'Open it in Excel or another spreadsheet to sort, filter or share the risks. The app makes cells safe, so a cell cannot run a formula.',
  },
  'start.export-oscal': {
    what: 'A plan of action and milestones in the NIST OSCAL format. It lists the risks and the planned responses.',
    why: 'Give it to an auditor or a compliance tool that reads OSCAL.',
    source: 'NIST OSCAL POA&M model.',
  },
  'start.export-passphrase': {
    what: 'A passphrase that locks the copy. Use 12 characters or more. Four random words are easy to remember and hard to guess.',
    why: 'You can keep an encrypted copy in a shared folder or send it by email. Without the passphrase nobody can open it, also not you. Keep the passphrase in a password manager.',
  },
  'start.storage': {
    what: 'How much space the app uses in this browser, and if the browser can delete the data.',
    why: 'The data stays on this computer only. The app does not encrypt it, so protect the computer and export a copy often.',
  },
  'start.remove-all': {
    what: 'Deletes every document, every kept version, the cache and the offline copy of the app from this browser.',
    why: 'Use it before you give the computer to another person or when you stop using the app. You cannot undo it, so export a copy first.',
  },
} as const satisfies HelpTexts;
