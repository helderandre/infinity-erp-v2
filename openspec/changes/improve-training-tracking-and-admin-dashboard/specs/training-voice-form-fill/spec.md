## ADDED Requirements

### Requirement: Voice dictation endpoint for course form

The system SHALL expose `POST /api/training/courses/fill-from-voice` that accepts a multipart audio blob and returns a structured JSON matching `createCourseSchema` (title, summary, description, category_id suggestion, difficulty_level, instructor_name, estimated_duration_minutes, is_mandatory, has_certificate, passing_score, tags).

The endpoint MUST:
- Require authenticated user with permission `training` OR role broker/admin (403 otherwise).
- Transcribe audio using OpenAI Whisper in Portuguese (reuse prompt from `/api/transcribe`).
- Extract structured fields using GPT-4o-mini with a strict JSON schema; fields not mentioned in the dictation remain `null`.
- Return `{ transcription: string, fields: Partial<CreateCourseInput>, category_match?: { id, name } | null }`.
- Never overwrite the existing form — the client merges only `non-null` fields with whatever the user already typed.

#### Scenario: Broker dictates full course

- **WHEN** an authenticated broker uploads a 30s audio saying "curso de qualificação de compradores, nível intermédio, 90 minutos, obrigatório, sem certificado"
- **THEN** the endpoint responds 200 with `fields.title="Qualificação de Compradores"`, `fields.difficulty_level="intermediate"`, `fields.estimated_duration_minutes=90`, `fields.is_mandatory=true`, `fields.has_certificate=false`
- **AND** the transcription text is included in the response for optional display

#### Scenario: Unauthenticated request

- **WHEN** a request hits `/api/training/courses/fill-from-voice` without a valid session
- **THEN** the endpoint responds 401

#### Scenario: User without training permission

- **WHEN** a consultor (no `training` permission, not broker) calls the endpoint
- **THEN** the endpoint responds 403 with message "Permissão necessária: training"

#### Scenario: Missing or invalid audio

- **WHEN** the request multipart has no `audio` field or it is not a Blob
- **THEN** the endpoint responds 400 with message "Ficheiro de áudio em falta"

#### Scenario: OpenAI key missing

- **WHEN** `OPENAI_API_KEY` is not configured
- **THEN** the endpoint responds 503 with message "Serviço de IA não configurado"

#### Scenario: Audio has no course-related content

- **WHEN** the audio transcribes to unrelated content (e.g. "hoje está a chover")
- **THEN** the endpoint responds 200 with transcription included and `fields` as an empty object `{}` (no hallucinated data)

### Requirement: Inline voice input on individual fields

The system SHALL provide a reusable `<VoiceInputButton />` component that sits next to any text field and, when pressed, records audio, calls `/api/transcribe`, and appends (or replaces, if field is empty) the transcribed text into that field via a `onTranscribe(text: string)` callback.

#### Scenario: Consultor dictates description of an existing course

- **WHEN** broker in `/dashboard/formacoes/gestao/[id]/editar` clicks the microphone next to "Descrição" and speaks for 10s
- **THEN** the recorded audio is sent to `/api/transcribe`
- **AND** the returned text is appended to the current value of the `description` field
- **AND** the user can review/edit the text before saving

#### Scenario: Recording cancelled

- **WHEN** user clicks the microphone a second time while recording
- **THEN** recording stops and is discarded without any network call

#### Scenario: Browser denies microphone permission

- **WHEN** `getUserMedia` throws `NotAllowedError`
- **THEN** a toast shows "Permissão de microfone negada" and the button returns to idle state

### Requirement: Dictate-full-form button in new course page

The system SHALL add a "Ditar tudo" button in `/dashboard/formacoes/gestao/novo` that opens a modal with a single large recording button. After recording, the modal shows the transcription and the extracted fields side-by-side, letting the user accept-all, edit, or cancel.

#### Scenario: User accepts extracted fields

- **WHEN** user records, the endpoint returns fields, and user clicks "Aplicar"
- **THEN** the form is populated with the extracted non-null fields
- **AND** the modal closes
- **AND** fields already typed before opening the modal are preserved if the extraction returned `null` for them

#### Scenario: User cancels

- **WHEN** user records but then clicks "Cancelar" without applying
- **THEN** the form remains untouched and the audio blob is discarded

#### Scenario: Category name matched

- **WHEN** the dictation mentions a category name that matches an existing `training_categories.name` case-insensitively
- **THEN** the response includes `category_match.id` and the form's `category_id` select is pre-filled
