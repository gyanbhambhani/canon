Add an endpoint to set the thermostat: `POST /thermostat`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `temperature` | integer | from 10 to 30 inclusive (degrees Celsius) |
| `mode` | string | one of `eco`, `comfort`, `away` (exactly, lower case) |

Response `200`: the setting, `{"temperature": ..., "mode": ...}`, with the values as sent.

Frontend: add `frontend/src/features/setThermostat.ts` exporting `setThermostat(baseUrl: string, input: { temperature: number; mode: string }): Promise<Outcome<{ temperature: number; mode: string }>>`.
