import { z } from "zod";

// Initialize before application schemas: strict CSP forbids even a caught eval probe.
z.config({ jitless: true });
