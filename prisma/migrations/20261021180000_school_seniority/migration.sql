-- Antigüedad en el establecimiento (meses). Null para externos y para inscripciones anteriores.
ALTER TABLE "applicant" ADD COLUMN "school_seniority_months" INTEGER;
