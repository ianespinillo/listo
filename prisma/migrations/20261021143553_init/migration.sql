-- CreateEnum
CREATE TYPE "position_type" AS ENUM ('ASIGNATURA', 'CARGO');

-- CreateEnum
CREATE TYPE "employment_status" AS ENUM ('TITULAR', 'PROVISIONAL', 'SUPLENTE', 'EXTERNO');

-- CreateEnum
CREATE TYPE "shift" AS ENUM ('MANANA', 'TARDE', 'VESPERTINO');

-- CreateEnum
CREATE TYPE "event_type" AS ENUM ('INSCRIPCION', 'CAMBIO_DATOS', 'CAMBIO_PUNTAJE', 'ALTA_MATERIA', 'BAJA_MATERIA', 'VERIFICACION', 'DESVERIFICACION', 'CAMBIO_EMAIL', 'BAJA', 'REACTIVACION');

-- CreateTable
CREATE TABLE "cycle" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "registration_from" DATE NOT NULL,
    "registration_until" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "position_type" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicant" (
    "id" SERIAL NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "dni" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "employment_status" "employment_status" NOT NULL,
    "seniority_months" INTEGER NOT NULL,
    "shifts" "shift"[],
    "deactivated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application" (
    "applicant_id" INTEGER NOT NULL,
    "position_id" INTEGER NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "modified" BOOLEAN NOT NULL DEFAULT false,
    "previous_score" DECIMAL(5,2),
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "application_pkey" PRIMARY KEY ("applicant_id","position_id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" SERIAL NOT NULL,
    "applicant_id" INTEGER NOT NULL,
    "type" "event_type" NOT NULL,
    "position_id" INTEGER,
    "detail" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "token_hash" TEXT NOT NULL,
    "admin_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("token_hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "cycle_year_key" ON "cycle"("year");

-- CreateIndex
CREATE UNIQUE INDEX "position_name_key" ON "position"("name");

-- CreateIndex
CREATE INDEX "applicant_cycle_id_deactivated_idx" ON "applicant"("cycle_id", "deactivated");

-- CreateIndex
CREATE UNIQUE INDEX "applicant_cycle_id_dni_key" ON "applicant"("cycle_id", "dni");

-- CreateIndex
CREATE INDEX "application_position_id_idx" ON "application"("position_id");

-- CreateIndex
CREATE INDEX "event_applicant_id_occurred_at_idx" ON "event"("applicant_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_email_key" ON "admin"("email");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- AddForeignKey
ALTER TABLE "applicant" ADD CONSTRAINT "applicant_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
