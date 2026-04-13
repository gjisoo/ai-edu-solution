import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

async function readPdf() {
  const dataBuffer = fs.readFileSync('./docs/ai-edu-plan.pdf');
  const data = await pdf(dataBuffer);
  console.log(data.text);
}

readPdf().catch(console.error);
