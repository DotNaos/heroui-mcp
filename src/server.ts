import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import {
    getComponentList,
    getComponentExamples,
    getComponentApi,
} from "./heroUiScraper.js";
import {
    ComponentExampleSchema, // Import the schema for examples
    ComponentApiSchema,     // Import the schema for API
} from "./config.js"; // Import schemas from config

/**
 * MCP Server for interacting with HeroUI documentation.
 */
export class MinimalMcpServer {
    private readonly server: McpServer;

    constructor() {
        this.server = new McpServer(
            {
                // TODO: Replace with your server's actual name
                name: "HeroUI MCP Server",
                // TODO: Replace with your server's actual version
                version: "1.0.0",
            },
            {
                capabilities: {
                    // Enable logging capability
                    logging: {},
                    // Enable tools capability
                    tools: {},
                },
            },
        );

        this.registerTools();
    }

    /**
     * Registers the tools provided by this server.
     */
    private registerTools(): void {
        // Tool to get the list of all HeroUI components
        this.server.tool(
            "get_heroui_component_list",
            "Fetches a list of available HeroUI components from the documentation.",
            {}, // No input schema needed
            async () => {
                try {
                    this.log("Executing get_heroui_component_list tool");
                    const components = await getComponentList();

                    if (components.length === 0) {
                        return {
                            content: [{ type: "text", text: "Could not find any components. The documentation structure might have changed." }],
                        };
                    }

                    // Format the list for output
                    const componentListText = components.map(c => `- ${c.name} (${c.url})`).join('\\n');
                    return {
                        content: [{ type: "text", text: `Available HeroUI Components:\\n${componentListText}` }],
                    };
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.error(`Error in get_heroui_component_list tool: ${message}`);
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching component list: ${message}` }],
                    };
                }
            },
        );

        // Tool to get code examples for a specific HeroUI component
        this.server.tool(
            "get_heroui_component_examples",
            "Fetches code examples for a specific HeroUI component from the documentation.",
            { // Input schema
                componentName: z.string().describe("The name of the HeroUI component (e.g., 'accordion', 'button')."),
            },
            // Output schema using the imported schema from config.ts
            ComponentExampleSchema.array().describe("An array of code examples for the component."),
            async ({ componentName }) => {
                try {
                    this.log(`Executing get_heroui_component_examples tool for: ${componentName}`);
                    const examples = await getComponentExamples(componentName);

                    if (examples.length === 0) {
                        return {
                            content: [{ type: "text", text: `No examples found for component '${componentName}'. Check the component name or the documentation structure.` }],
                        };
                    }

                    // Return the structured examples directly
                    return { content: examples.map(ex => ({ type: "code", ...ex })) };

                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.error(`Error in get_heroui_component_examples tool for ${componentName}: ${message}`);
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching examples for ${componentName}: ${message}` }],
                    };
                }
            },
        );

        // Tool to get API documentation (props, events) for a specific HeroUI component
        this.server.tool(
            "get_heroui_component_api",
            "Fetches API documentation (props, events) for a specific HeroUI component.",
            { // Input schema
                componentName: z.string().describe("The name of the HeroUI component (e.g., 'accordion', 'button')."),
            },
            // Output schema using the imported schema from config.ts
            ComponentApiSchema.optional().describe("The API documentation (props, events) for the component, or null if not found."),
             async ({ componentName }) => {
                try {
                    this.log(`Executing get_heroui_component_api tool for: ${componentName}`);
                    const api = await getComponentApi(componentName);

                    if (!api) {
                        return {
                            content: [{ type: "text", text: `No API documentation found for component '${componentName}'. Check the component name or the documentation structure.` }],
                        };
                    }

                    // Format the API details for output
                    let apiText = `API for ${componentName}:\\n\\n`;
                    if (api.props.length > 0) {
                        apiText += "**Props:**\\n";
                        apiText += api.props.map(p => `- \`${p.name}\`: \`${p.type}\`${p.defaultValue ? ` (default: \`${p.defaultValue}\`)` : ''}${p.description ? ` - ${p.description}` : ''}`).join('\\n');
                        apiText += "\\n\\n";
                    }
                    if (api.events.length > 0) {
                        apiText += "**Events:**\\n";
                        apiText += api.events.map(e => `- \`${e.name}\`: \`${e.type}\`${e.description ? ` - ${e.description}` : ''}`).join('\\n');
                    }

                    // Return both the structured data and a formatted text version
                    return {
                        // You can return the structured 'api' object directly if the client prefers that
                        // content: [{ type: "json", json: api }],
                        // Or return a formatted text version
                         content: [{ type: "text", text: apiText.trim() || "No API details extracted." }],
                    };

                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.error(`Error in get_heroui_component_api tool for ${componentName}: ${message}`);
                    return {
                        isError: true,
                        content: [{ type: "text", text: `Error fetching API for ${componentName}: ${message}` }],
                    };
                }
            },
        );
    }

    /**
     * Connects the server to a transport layer.
     * @param transport - The transport to connect to.
     */
    async connect(transport: Transport): Promise<void> {
        await this.server.connect(transport);
        this.log("Minimal MCP Server connected via stdio and ready.");
    }

    /**
     * Sends an informational log message to the client.
     * @param data - The data to log.
     */
    private log(...data: unknown[]): void {
        this.server.server.sendLoggingMessage({
            level: "info",
            data: data.map(item => typeof item === 'string' ? item : JSON.stringify(item)),
        });
    }

    /**
     * Sends an error log message to the client.
     * @param data - The data to log.
     */
    private error(...data: unknown[]): void {
        this.server.server.sendLoggingMessage({
            level: "error",
            data: data.map(item => typeof item === 'string' ? item : JSON.stringify(item)),
        });
    }
}
