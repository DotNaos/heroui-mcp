import { z } from 'zod';

export const BASE_URL = 'https://www.heroui.com/docs';

/**
 * Custom error class for web scraping operations.
 */
export class ScrapingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ScrapingError';
    }
}

// --- Zod Schemas and Types ---

export const ComponentExampleSchema = z.object({
    title: z.string().optional().describe("Optional title or description of the example."),
    code: z.string().describe("The code snippet for the example."),
    language: z.string().default('typescript').describe("The language of the code snippet (e.g., typescript, javascript, jsx)."),
});
export type ComponentExample = z.infer<typeof ComponentExampleSchema>;

export const ComponentApiSchema = z.object({
    props: z.array(z.object({
        name: z.string(),
        type: z.string(),
        description: z.string().optional(),
        defaultValue: z.string().optional(),
    })).describe("Component properties (props)."),
    events: z.array(z.object({
        name: z.string(),
        type: z.string(),
        description: z.string().optional(),
    })).describe("Component events."),
    // Add other API sections like types, slots if needed
});
export type ComponentApi = z.infer<typeof ComponentApiSchema>;
