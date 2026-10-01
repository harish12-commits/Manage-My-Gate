import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import villaService from '../villa/villa.services.js';
import userService from '../user/user.services.js';
import onboardingWizardEvents from './onboardingWizard.events.js';
import HttpError from '../../utils/httpError.utils.js';
import logger, { loggerStorage } from '../../utils/logger.utils.js';
import crypto from 'crypto';

const MAX_IMPORT_ROWS = 5000;

const cellToValue = (cell) => {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') {
    if (cell instanceof Date) return cell.toISOString();
    if (cell.text !== undefined) return cell.text;
    if (cell.result !== undefined) return cell.result;
    if (Array.isArray(cell.richText)) return cell.richText.map((t) => t.text).join('');
    return '';
  }
  return cell;
};

/** Parses an .xlsx (zip magic "PK") or CSV buffer into header-keyed row objects. */
const parseSpreadsheet = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  if (buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    await workbook.xlsx.load(buffer);
  } else {
    await workbook.csv.read(Readable.from(buffer), { map: (value) => value });
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return null;
  const rows = [];
  let headers = null;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values.slice(1).map(cellToValue);
    if (!headers) {
      headers = values.map((h) => String(h).trim());
      return;
    }
    if (rows.length >= MAX_IMPORT_ROWS) return;
    const obj = {};
    headers.forEach((h, idx) => {
      if (h && h !== '__proto__' && h !== 'constructor' && h !== 'prototype') obj[h] = values[idx] ?? '';
    });
    rows.push(obj);
  });
  return rows;
};

export class OnboardingWizardService {
  /**
   * Parse and validate imported CSV or XLSX file buffer.
   * @param {Buffer} fileBuffer 
   * @param {string} organisationId 
   * @returns {Promise<{ totalRows: number, validRows: Array, invalidRows: Array, isValid: boolean }>}
   */
  async validateImportFile(fileBuffer, organisationId) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('validateImportFile request received', { organisationId, correlationId });

    if (!organisationId) {
      throw new HttpError(400, 'Organization ID (organisationId) is required.');
    }
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new HttpError(400, 'Invalid or missing file buffer.');
    }

    let rows;
    try {
      rows = await parseSpreadsheet(fileBuffer);
    } catch (parseError) {
      logger.error('Failed to parse spreadsheet', { error: parseError.message, correlationId });
      throw new HttpError(400, 'Failed to parse file. Please ensure it is a valid .csv or .xlsx file.');
    }

    if (!rows) {
      throw new HttpError(400, 'Uploaded spreadsheet file is empty or invalid.');
    }

    const totalRows = rows.length;
    const validRows = [];
    const invalidRows = [];
    const seenVillaNumbers = new Set();

    const phoneRegex = /^\+?[1-9]\d{7,14}$/;

    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i];
      const rowNumber = i + 1;
      const errors = [];

      // Extract values supporting standard header name variations
      const ownerName = rowData.ownerName ?? rowData['Owner Name'] ?? rowData.owner_name ?? rowData.owner ?? '';
      const villaNumber = rowData.villaNumber ?? rowData['Villa Number'] ?? rowData.villa_number ?? rowData['Unit Number'] ?? rowData.unitNumber ?? rowData.villa ?? '';
      const phone = rowData.phone ?? rowData['Phone'] ?? rowData.phoneNumber ?? rowData['Phone Number'] ?? rowData.mobile ?? rowData['Mobile'] ?? '';

      const trimmedOwnerName = String(ownerName).trim();
      const trimmedVillaNumber = String(villaNumber).trim();
      const trimmedPhone = String(phone).trim();

      // a. Missing Data Check
      if (!trimmedOwnerName) {
        errors.push('ownerName is required');
      }
      if (!trimmedVillaNumber) {
        errors.push('villaNumber is required');
      }

      // b. Format Check (Phone)
      const cleanPhoneDigits = trimmedPhone.replace(/[\s\-\(\)]/g, '');
      if (!trimmedPhone || !phoneRegex.test(cleanPhoneDigits)) {
        errors.push('Invalid phone number format');
      }

      // c. Intra-file Duplicates Check
      if (trimmedVillaNumber) {
        const normalizedVilla = trimmedVillaNumber.toLowerCase();
        if (seenVillaNumbers.has(normalizedVilla)) {
          errors.push(`Duplicate villaNumber '${trimmedVillaNumber}' found in file`);
        } else {
          seenVillaNumbers.add(normalizedVilla);
        }

        // d. Database Duplicates Check (via villaService only)
        try {
          const existsInDb = await villaService.checkVillaExists(trimmedVillaNumber, organisationId);
          if (existsInDb) {
            errors.push(`Villa number '${trimmedVillaNumber}' already exists in database`);
          }
        } catch (dbError) {
          logger.error('Error verifying villa existence in database', {
            error: dbError.message,
            villaNumber: trimmedVillaNumber,
            correlationId,
          });
          errors.push(`Failed to verify villa number '${trimmedVillaNumber}' against database`);
        }
      }

      if (errors.length > 0) {
        invalidRows.push({
          row: rowNumber,
          data: rowData,
          errors,
        });
      } else {
        validRows.push(rowData);
      }
    }

    const isValid = invalidRows.length === 0;

    return {
      totalRows,
      validRows,
      invalidRows,
      isValid,
    };
  }

  /**
   * Execute bulk import transaction for pre-validated data array.
   * Enforces strictly all-or-nothing Mongoose transaction.
   * @param {Array} validDataArray 
   * @param {string} organisationId 
   * @returns {Promise<{ success: boolean, importedCount: number, data: Array }>}
   */
  async executeImport(validDataArray, organisationId) {
    const correlationId = loggerStorage.getStore() || 'N/A';
    logger.info('executeImport request received', {
      organisationId,
      recordCount: validDataArray?.length,
      correlationId,
    });

    if (!organisationId) {
      throw new HttpError(400, 'Organization ID (organisationId) is required.');
    }
    if (!Array.isArray(validDataArray) || validDataArray.length === 0) {
      throw new HttpError(400, 'validDataArray must be a non-empty array.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const importedResults = [];

    try {
      for (const item of validDataArray) {
        const ownerName = item.ownerName ?? item['Owner Name'] ?? item.owner_name ?? item.owner ?? '';
        const villaNumber = item.villaNumber ?? item['Villa Number'] ?? item.villa_number ?? item['Unit Number'] ?? item.unitNumber ?? item.villa ?? '';
        const phone = item.phone ?? item['Phone'] ?? item.phoneNumber ?? item['Phone Number'] ?? item.mobile ?? item['Mobile'] ?? '';
        const email = item.email ?? item['Email'] ?? item.userEmail ?? `${String(villaNumber).toLowerCase().replace(/[^a-z0-9]/g, '')}@community.local`;
        const blockOrBuilding = item.blockOrBuilding ?? item['Block'] ?? item['Building'] ?? item.block ?? '';

        // 1. Create Villa / Unit
        const villaData = {
          unitNumber: String(villaNumber).trim(),
          blockOrBuilding: String(blockOrBuilding).trim(),
          type: item.type || item.villaType || 'Villa',
          status: item.status || 'Occupied',
        };

        const villa = await villaService.createVilla(organisationId, villaData, session);

        // 2. Create User if ownerName is present
        let user = null;
        if (ownerName && String(ownerName).trim() !== '') {
          const trimmedOwnerName = String(ownerName).trim();
          const nameParts = trimmedOwnerName.split(' ');
          const firstName = nameParts[0] || trimmedOwnerName;
          const lastName = nameParts.slice(1).join(' ') || 'Resident';

          const userData = {
            name: trimmedOwnerName,
            firstName,
            lastName,
            email: String(email).trim().toLowerCase(),
            username: String(email).trim().toLowerCase(),
            phone: String(phone).trim(),
            password: crypto.randomBytes(16).toString('hex') + 'Aa1!', // Random secure password requiring reset
            roles: ['Resident'],
            orgId: organisationId,
          };

          user = await userService.createUser(userData, session);

          // Assign resident to villa
          if (villa && user) {
            await villaService.assignResidentToVilla(villa._id, user._id, 'Owner', session);
          }
        }

        importedResults.push({
          villaId: villa._id,
          unitNumber: villa.unitNumber,
          userId: user?._id || null,
        });
      }

      await session.commitTransaction();
      session.endSession();

      // Emit onboarding.import_completed event upon successful commit
      onboardingWizardEvents.emit('onboarding.import_completed', {
        organisationId,
        count: importedResults.length,
        timestamp: new Date(),
      });

      return {
        success: true,
        importedCount: importedResults.length,
        data: importedResults,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      logger.error('Failed to execute onboarding import, transaction aborted', {
        error: error.message,
        organisationId,
        correlationId,
      });

      throw new HttpError(
        error.statusCode || 500,
        `Import execution failed and transaction was rolled back: ${error.message}`
      );
    }
  }
}

export default new OnboardingWizardService();
