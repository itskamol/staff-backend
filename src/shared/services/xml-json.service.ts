import * as xml2js from 'xml2js';
import * as js2xmlparser from 'js2xmlparser';
import { Injectable } from '@nestjs/common';

export interface XmlToJsonOptions {
    explicitArray?: boolean;
    ignoreAttrs?: boolean;
    mergeAttrs?: boolean;
    explicitRoot?: boolean;
    trim?: boolean;
    normalize?: boolean;
    normalizeTags?: boolean;
    attrkey?: string;
    charkey?: string;
    explicitCharkey?: boolean;
}

export interface JsonToXmlOptions {
    declaration?: {
        include?: boolean;
        encoding?: string;
        version?: string;
    };
    format?: {
        doubleQuotes?: boolean;
        indent?: string;
        newline?: string;
        pretty?: boolean;
    };
    typeHandlers?: {
        [key: string]: (value: any) => any;
    };
    wrapArray?: {
        enabled?: boolean;
        elementName?: string;
    };
    useCDATA?: boolean;
    convertMap?: {
        [key: string]: string;
    };
}

@Injectable()
export class XmlJsonService {
    /**
     * Convert XML string to JSON object
     * @param xmlString - XML string to convert
     * @param options - Conversion options
     * @returns Promise<any> - Parsed JSON object
     */
    async xmlToJson(xmlString: string, options?: XmlToJsonOptions): Promise<any> {
        try {
            const defaultOptions: XmlToJsonOptions = {
                explicitArray: false,
                ignoreAttrs: false,
                mergeAttrs: false,
                explicitRoot: true,
                trim: true,
                normalize: true,
                normalizeTags: false,
                attrkey: '@',
                charkey: '#text',
                explicitCharkey: false,
                ...options,
            };

            const parser = new xml2js.Parser(defaultOptions);
            const result = await parser.parseStringPromise(xmlString);

            return result;
        } catch (error) {
            throw new Error(`Failed to parse XML to JSON: ${error.message}`);
        }
    }

    /**
     * Convert JSON object to XML string
     * @param jsonObject - JSON object to convert
     * @param rootElementName - Name of the root XML element
     * @param options - Conversion options
     * @returns string - XML string
     */
    jsonToXml(
        jsonObject: any,
        rootElementName: string = 'root',
        options?: JsonToXmlOptions
    ): string {
        try {
            const defaultOptions: JsonToXmlOptions = {
                declaration: {
                    include: true,
                    encoding: 'UTF-8',
                    version: '1.0',
                },
                format: {
                    doubleQuotes: true,
                    indent: '  ',
                    newline: '\n',
                    pretty: true,
                },
                useCDATA: false,
                ...options,
            };

            return js2xmlparser.parse(rootElementName, jsonObject, defaultOptions);
        } catch (error) {
            throw new Error(`Failed to convert JSON to XML: ${error.message}`);
        }
    }

    /**
     * Convert XML string to JSON and remove root element
     * @param xmlString - XML string to convert
     * @param options - Conversion options
     * @returns Promise<any> - Parsed JSON object without root wrapper
     */
    async xmlToJsonFlat(xmlString: string, options?: XmlToJsonOptions): Promise<any> {
        const result = await this.xmlToJson(xmlString, { ...options, explicitRoot: false });
        return result;
    }

    /**
     * Convert JSON object to XML string with custom formatting
     * @param jsonObject - JSON object to convert
     * @param rootElementName - Name of the root XML element
     * @param pretty - Whether to format the XML with indentation
     * @returns string - Formatted XML string
     */
    jsonToXmlPretty(
        jsonObject: any,
        rootElementName: string = 'root',
        pretty: boolean = true
    ): string {
        return this.jsonToXml(jsonObject, rootElementName, {
            format: {
                pretty,
                indent: pretty ? '  ' : '',
                newline: pretty ? '\n' : '',
            },
        });
    }

    /**
     * Convert XML attributes to a more readable format
     * @param xmlString - XML string to convert
     * @returns Promise<any> - JSON with attributes merged into objects
     */
    async xmlToJsonWithMergedAttrs(xmlString: string): Promise<any> {
        return this.xmlToJson(xmlString, {
            mergeAttrs: true,
            explicitArray: false,
            ignoreAttrs: false,
        });
    }

    /**
     * Convert JSON to XML without XML declaration
     * @param jsonObject - JSON object to convert
     * @param rootElementName - Name of the root XML element
     * @returns string - XML string without declaration
     */
    jsonToXmlNoDeclaration(jsonObject: any, rootElementName: string = 'root'): string {
        return this.jsonToXml(jsonObject, rootElementName, {
            declaration: {
                include: false,
            },
        });
    }

    /**
     * Validate if string is valid XML
     * @param xmlString - String to validate
     * @returns Promise<boolean> - True if valid XML
     */
    async isValidXml(xmlString: string): Promise<boolean> {
        try {
            const parser = new xml2js.Parser();
            await parser.parseStringPromise(xmlString);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate if object can be converted to XML
     * @param jsonObject - Object to validate
     * @returns boolean - True if can be converted
     */
    isValidJsonForXml(jsonObject: any): boolean {
        try {
            if (jsonObject === null || jsonObject === undefined) {
                return false;
            }

            // Check for circular references
            JSON.stringify(jsonObject);

            // Try to convert to XML
            this.jsonToXml(jsonObject, 'test');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Convert XML to JSON with custom attribute handling
     * @param xmlString - XML string to convert
     * @param attrPrefix - Prefix for attributes (default: '@')
     * @param textKey - Key for text content (default: '#text')
     * @returns Promise<any> - Parsed JSON object
     */
    async xmlToJsonCustom(
        xmlString: string,
        attrPrefix: string = '@',
        textKey: string = '#text'
    ): Promise<any> {
        return this.xmlToJson(xmlString, {
            attrkey: attrPrefix,
            charkey: textKey,
            explicitCharkey: false,
        });
    }

    /**
     * Convert JSON to XML with CDATA sections for string values
     * @param jsonObject - JSON object to convert
     * @param rootElementName - Name of the root XML element
     * @returns string - XML string with CDATA sections
     */
    jsonToXmlWithCDATA(jsonObject: any, rootElementName: string = 'root'): string {
        return this.jsonToXml(jsonObject, rootElementName, {
            format: {
                pretty: true,
                doubleQuotes: true,
            },
            useCDATA: true,
        });
    }

    /**
     * Transform string values in object to CDATA format
     * @param obj - Object to transform
     * @returns any - Transformed object
     */
    private transformStringsToCDATA(obj: any): any {
        if (typeof obj === 'string') {
            // Check if string contains special characters that need CDATA
            if (obj.includes('<') || obj.includes('>') || obj.includes('&') || obj.includes('"')) {
                return `<![CDATA[${obj}]]>`;
            }
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.transformStringsToCDATA(item));
        }

        if (obj !== null && typeof obj === 'object') {
            const transformed: any = {};
            for (const [key, value] of Object.entries(obj)) {
                transformed[key] = this.transformStringsToCDATA(value);
            }
            return transformed;
        }

        return obj;
    }

    /**
     * Convert XML to JSON and clean up common XML artifacts
     * @param xmlString - XML string to convert
     * @returns Promise<any> - Cleaned JSON object
     */
    async xmlToJsonClean(xmlString: string): Promise<any> {
        const result = await this.xmlToJson(xmlString, {
            explicitArray: false,
            ignoreAttrs: true,
            explicitRoot: false,
            trim: true,
            normalize: true,
            explicitCharkey: false,
        });

        return this.cleanJsonFromXml(result);
    }

    /**
     * Clean JSON object from XML parsing artifacts
     * @param obj - Object to clean
     * @returns any - Cleaned object
     */
    private cleanJsonFromXml(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.cleanJsonFromXml(item));
        }

        if (obj !== null && typeof obj === 'object') {
            const cleaned: any = {};

            for (const [key, value] of Object.entries(obj)) {
                // Skip empty objects and arrays
                if (value === '' || (Array.isArray(value) && value.length === 0)) {
                    continue;
                }

                // Recursively clean nested objects
                cleaned[key] = this.cleanJsonFromXml(value);
            }

            return cleaned;
        }

        return obj;
    }

    /**
     * Convert between XML and JSON with error handling and logging
     * @param input - Input string (XML) or object (JSON)
     * @param toFormat - Target format ('xml' or 'json')
     * @param rootElementName - Root element name for JSON to XML conversion
     * @param options - Conversion options
     * @returns Promise<string | any> - Converted result
     */
    async convert(
        input: string | any,
        toFormat: 'xml' | 'json',
        rootElementName: string = 'root',
        options?: XmlToJsonOptions | JsonToXmlOptions
    ): Promise<string | any> {
        try {
            if (toFormat === 'json') {
                if (typeof input !== 'string') {
                    throw new Error('Input must be a string for XML to JSON conversion');
                }
                return await this.xmlToJson(input, options as XmlToJsonOptions);
            } else {
                if (typeof input === 'string') {
                    throw new Error('Input must be an object for JSON to XML conversion');
                }
                return this.jsonToXml(input, rootElementName, options as JsonToXmlOptions);
            }
        } catch (error) {
            throw new Error(`Conversion failed: ${error.message}`);
        }
    }
}
