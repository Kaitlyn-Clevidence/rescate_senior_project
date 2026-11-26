// Author(s): Isabel Sullivan
// Start date: 2026-11-23
// Last updated: 2026-11-23
// P5: MVP
// Purpose: the only code that reads and writes attachment files; saves them
// to a local folder for now, so moving to cloud storage later only changes this file

import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";

export interface StorageService {
    save(key: string, data: Buffer): Promise<void>;
    read(key: string): Promise<Buffer>;
    remove(key: string): Promise<void>;
}

//Keys are always made by AttachmentSerivce
//Anything else is refused
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|heic|pdf)$/;

export function isValidKey(key:string): boolean {
    return KEY_PATTERN.test(key);
}

export function createLocalStorage(folder: string): StorageService {
    function pathFor(key: string){
        if(!isValidKey(key)){
            throw new Error(`Invalid storage key: ${key}`);
            }
            return join(folder, key);
        }

    return {
        async save(key, data) {
            const path = pathFor(key);
            await mkdir(folder, {recursive: true});
            await writeFile(path, data, {flag: "wx"});
        },

        async read(key) {
            return readFile(pathFor(key));
        },

        async remove(key) {
            await rm(pathFor(key), {force: true});
        }
    };
}