export interface RawElement {
    id: string;
    name: string;
}
export interface RawProduct {
    id: string;
    tier: number;
}
export declare function loadMetalElements(): RawElement[];
export declare function loadOrganicElements(): RawElement[];
export declare function loadMetalProducts(): RawProduct[];
export declare function loadOrganicProducts(): RawProduct[];
