import { google, type sheets_v4 } from 'googleapis'

type ServiceAccountJson = {
  client_email: string
  private_key: string
}

function parseServiceAccountJson(): ServiceAccountJson {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  let jsonText: string | undefined
  if (b64) {
    jsonText = Buffer.from(b64, 'base64').toString('utf8')
  } else if (raw) {
    jsonText = raw
  }

  if (!jsonText) {
    throw new Error(
      'Falta configuración: definí GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (recomendado) o GOOGLE_SERVICE_ACCOUNT_JSON en el servidor.'
    )
  }

  const parsed = JSON.parse(jsonText) as Partial<ServiceAccountJson>
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON inválido: faltan client_email/private_key.')
  }

  return { client_email: parsed.client_email, private_key: parsed.private_key }
}

export function getSheetsClient(): sheets_v4.Sheets {
  const creds = parseServiceAccountJson()

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return google.sheets({ version: 'v4', auth })
}
