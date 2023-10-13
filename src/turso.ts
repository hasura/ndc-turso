import { createClient, Client } from "@libsql/client";
import { CredentialSchema } from ".";

export function getTursoClient(credentials: CredentialSchema): Client {
    return createClient({
        url: credentials.url,
        syncUrl: credentials.syncUrl,
        authToken: credentials.authToken
    });
}