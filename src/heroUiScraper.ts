import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import {
    BASE_URL,
    ScrapingError,
    type ComponentExample,
    type ComponentApi
} from './config.js'; // Import from config

// Fetches HTML content from a given URL
async function fetchHtml(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new ScrapingError(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return await response.text();
    } catch (error) {
        if (error instanceof ScrapingError) {
            throw error;
        }
        throw new ScrapingError(`Network error fetching ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- Component List ---

// Fetches and parses the list of components from the sidebar navigation
export async function getComponentList(): Promise<{ name: string; url: string }[]> {
    try {
        const html = await fetchHtml(`${BASE_URL}/guide/introduction`);
        const $ = cheerio.load(html);
        const components: { name: string; url: string }[] = [];

        // Find the "Components" section in the sidebar nav
        // This selector might need adjustment if the site structure changes
        $('nav a[href^="/docs/components/"]').each((_, element) => {
            const link = $(element);
            const href = link.attr('href');
            const name = link.text().trim();
            if (href && name && !href.endsWith('/components/')) { // Exclude the main components link
                 // Ensure the URL is absolute or relative to the base
                 const fullUrl = href.startsWith('http') ? href : `https://www.heroui.com${href}`;
                components.push({ name, url: fullUrl });
            }
        });

         if (components.length === 0) {
             // Fallback or more specific error if the selector failed
             console.warn("Could not find components using the primary selector. Check site structure.");
             // Potentially try alternative selectors here if needed
         }

        return components;
    } catch (error) {
        console.error("Error fetching component list:", error);
        throw new ScrapingError(`Failed to get component list: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- Component Examples ---

// Fetches and parses code examples for a specific component
export async function getComponentExamples(componentName: string): Promise<ComponentExample[]> {
     const componentUrl = `${BASE_URL}/components/${componentName.toLowerCase()}`;
    try {
        const html = await fetchHtml(componentUrl);
        const $ = cheerio.load(html);
        const examples: ComponentExample[] = [];

        // Find example blocks. This selector targets the structure observed on the accordion page.
        // It looks for a 'Preview' button and then finds the associated code block.
        // This might need significant adjustment based on other component pages.
        $('div[data-slot="component-preview"]').each((_, previewDiv) => {
            const $previewDiv = $(previewDiv);
            // Try to find a preceding heading as a title
            const title = $previewDiv.prevAll('h3').first().text().trim() || undefined;
            // Find the code within the preview div
            const codeElement = $previewDiv.find('pre code'); // Adjust selector based on actual structure
            const code = codeElement.text().trim();
            const language = codeElement.attr('class')?.split('-').pop() || 'typescript'; // Basic language detection

            if (code) {
                examples.push({ title, code, language });
            }
        });

         if (examples.length === 0) {
             console.warn(`No examples found for ${componentName} using the current selectors. The page structure might differ.`);
             // Consider adding fallback selectors or logging the HTML structure for debugging
         }

        return examples;
    } catch (error) {
        console.error(`Error fetching examples for ${componentName}:`, error);
        // Don't throw ScrapingError if it's just that the component page doesn't exist (404)
        if (error instanceof ScrapingError && !error.message.includes('404')) {
             throw error;
        } else if (!(error instanceof ScrapingError)) {
            // Rethrow unexpected errors
             throw new ScrapingError(`Failed to get examples for ${componentName}: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Return empty array if fetch failed likely due to 404 (component not found)
        return [];
    }
}


// --- Component API ---

// Fetches and parses API information (props, events) for a specific component
export async function getComponentApi(componentName: string): Promise<ComponentApi | null> {
    const componentUrl = `${BASE_URL}/components/${componentName.toLowerCase()}`;
     try {
        const html = await fetchHtml(componentUrl);
        const $ = cheerio.load(html);
        const api: ComponentApi = { props: [], events: [] };

        // Find API sections - selectors based on observed structure (e.g., h3 followed by table)
        $('h3').each((_, h3) => {
            const $h3 = $(h3);
            const title = $h3.text().trim().toLowerCase();
            const table = $h3.next('table').first(); // Assuming table directly follows heading

            if (table.length > 0) {
                if (title.includes('props')) {
                    table.find('tbody tr').each((_, tr) => {
                        const cells = $(tr).find('td');
                        if (cells.length >= 2) { // Need at least name and type
                            api.props.push({
                                name: $(cells[0]).text().trim(),
                                type: $(cells[1]).text().trim(),
                                // Description and default value might be in other cells or need specific selectors
                                description: cells.length > 2 ? $(cells[2]).text().trim() : undefined,
                                defaultValue: cells.length > 3 ? $(cells[3]).text().trim() : undefined,
                            });
                        }
                    });
                } else if (title.includes('events')) {
                     table.find('tbody tr').each((_, tr) => {
                        const cells = $(tr).find('td');
                        if (cells.length >= 2) { // Need at least name and type
                            api.events.push({
                                name: $(cells[0]).text().trim(),
                                type: $(cells[1]).text().trim(),
                                description: cells.length > 2 ? $(cells[2]).text().trim() : undefined,
                            });
                        }
                    });
                }
                // Add logic for other sections like 'Types', 'Slots' if needed
            }
        });

        // Basic validation: Check if we actually found anything
        if (api.props.length === 0 && api.events.length === 0) {
             console.warn(`No API information found for ${componentName} using current selectors.`);
             return null; // Indicate no API info found
        }

        return api;
    } catch (error) {
        console.error(`Error fetching API for ${componentName}:`, error);
         if (error instanceof ScrapingError && !error.message.includes('404')) {
             throw error;
        } else if (!(error instanceof ScrapingError)) {
             throw new ScrapingError(`Failed to get API for ${componentName}: ${error instanceof Error ? error.message : String(error)}`);
        }
        // Return null if fetch failed likely due to 404
        return null;
    }
}
