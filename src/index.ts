import {
  SchemaResponse,
  ObjectType,
  QueryRequest,
  QueryResponse,
  MutationRequest,
  MutationResponse,
  CapabilitiesResponse,
  ExplainResponse,
  start,
  Connector,
  InternalServerError,
} from "@hasura/ndc-sdk-typescript";
import { CAPABILITIES_RESPONSE, RAW_CONFIGURATION_SCHEMA } from "./constants";
import { do_query } from "./handlers/query";
import { do_mutation } from "./handlers/mutation";
import { do_explain } from "./handlers/explain";
import { do_get_schema } from "./handlers/schema";
import { get_turso_client } from "./turso";
import { Client } from "@libsql/client/.";
import { readFileSync } from "fs"; // Import synchronous file read function

// import { do_update_configuration } from "./handlers/updateConfiguration";
// import { JSONSchemaObject } from "@json-schema-tools/meta-schema";

export type ObjectFieldDetails = {
  field_names: string[];
  field_types: { [k: string]: string };
  primary_keys: string[];
  unique_keys: string[];
  nullable_keys: string[];
  foreign_keys: { [k: string]: { table: string; column: string } };
};

export type ConfigurationSchema = {
  collection_names: string[];
  object_types: { [k: string]: ObjectType };
  object_fields: { [k: string]: ObjectFieldDetails };
};

export type CredentialSchema = {
  url: string;
  syncUrl?: string;
  authToken?: string;
};

export type Configuration = {
  credentials: CredentialSchema;
  config?: ConfigurationSchema;
};

// export type RawConfiguration = Configuration;

export type State = {
  client: Client;
};

const connector: Connector<Configuration, State> = {
  /**
   * Validate the configuration files provided by the user, returning a validated 'Configuration',
   * or throwing an 'Error'. Throwing an error prevents Connector startup.
   * @param configuration
   */
  parseConfiguration(configurationDir: string): Promise<Configuration> {
    // Is this just supposed to read the configuration from the mounted volume?

    // What happened to server mode? How do users get the configuration file?
    // The Refresh Data Connector is gone from VSCode Extension, how do I get metadata?
    // Can I run the metadata build service myself somehow? I just want the metadata I need to start engine? Given a connector?
    // How will the registry/hub/whatever it is work now?

    try {
      const fileContent = readFileSync(configurationDir, 'utf8');
      const configObject: Configuration = JSON.parse(fileContent);
      return Promise.resolve(configObject);
    } catch (error) {
      console.error("Failed to parse configuration:", error);
      throw new InternalServerError(
        "Internal Server Error, server configuration is invalid",
        {}
      );
    }

  },

  /**
   * Initialize the connector's in-memory state.
   *
   * For example, any connection pools, prepared queries,
   * or other managed resources would be allocated here.
   *
   * In addition, this function should register any
   * connector-specific metrics with the metrics registry.
   * @param configuration
   * @param metrics
   */
  tryInitState(config: Configuration, __: unknown): Promise<State> {
    const client: Client = get_turso_client(config.credentials);
    return Promise.resolve({
      client: client,
    });
  },

  /**
   * Get the connector's capabilities.
   *
   * This function implements the [capabilities endpoint](https://hasura.github.io/ndc-spec/specification/capabilities.html)
   * from the NDC specification.
   * @param configuration
   */
  getCapabilities(_: Configuration): CapabilitiesResponse {
    return CAPABILITIES_RESPONSE;
  },

  // getRawConfigurationSchema(): JSONSchemaObject {
  //   return RAW_CONFIGURATION_SCHEMA;
  // },

  // makeEmptyConfiguration(): RawConfiguration {
  //   const conf: RawConfiguration = {
  //     credentials: {
  //       url: "",
  //     },
  //     config: {
  //       collection_names: [],
  //       object_fields: {},
  //       object_types: {}
  //     },
  //   };
  //   return conf;
  // },

  // updateConfiguration(
  //   configuration: RawConfiguration
  // ): Promise<RawConfiguration> {
  //   return do_update_configuration(configuration);
  // },

  /**
   * Validate the raw configuration provided by the user,
   * returning a configuration error or a validated [`Connector::Configuration`].
   * @param configuration
   */
  // validateRawConfiguration(
  //   configuration: RawConfiguration
  // ): Promise<Configuration> {
  //   return Promise.resolve(configuration);
  // },

  /**
   * Get the connector's schema.
   *
   * This function implements the [schema endpoint](https://hasura.github.io/ndc-spec/specification/schema/index.html)
   * from the NDC specification.
   * @param configuration
   */
  async getSchema(configuration: Configuration): Promise<SchemaResponse> {
    if (!configuration.config) {
      throw new InternalServerError(
        "Internal Server Error, server configuration is invalid",
        {}
      );
    }
    return Promise.resolve(do_get_schema(configuration));
  },

  /**
   * Explain a query by creating an execution plan
   *
   * This function implements the [explain endpoint](https://hasura.github.io/ndc-spec/specification/explain.html)
   * from the NDC specification.
   * @param configuration
   * @param state
   * @param request
   */
  queryExplain(
    configuration: Configuration,
    _: State,
    request: QueryRequest
  ): Promise<ExplainResponse> {
    if (!configuration.config) {
      throw new InternalServerError(
        "Internal Server Error, server configuration is invalid",
        {}
      );
    }
    return do_explain(configuration, request);
  },

  /**
   * Explain a mutation by creating an execution plan
   * @param configuration
   * @param state
   * @param request
   */
  mutationExplain(
    configuration: Configuration,
    _: State,
    request: MutationRequest
  ): Promise<ExplainResponse> {
    if (!configuration.config) {
      throw new InternalServerError(
        "Internal Server Error, server configuration is invalid",
        {}
      );
    }
    throw new InternalServerError("Not implemented", {});
  },

  /**
   * Execute a query
   *
   * This function implements the [query endpoint](https://hasura.github.io/ndc-spec/specification/queries/index.html)
   * from the NDC specification.
   * @param configuration
   * @param state
   * @param request
   */
  query(
    configuration: Configuration,
    state: State,
    request: QueryRequest
  ): Promise<QueryResponse> {
    if (!configuration.config) {
      throw new InternalServerError(
        "Internal Server Error, server configuration is invalid",
        {}
      );
    }
    return do_query(configuration, state, request);
  },

  /**
   * Execute a mutation
   *
   * This function implements the [mutation endpoint](https://hasura.github.io/ndc-spec/specification/mutations/index.html)
   * from the NDC specification.
   * @param configuration
   * @param state
   * @param request
   */
  mutation(
    configuration: Configuration,
    state: State,
    request: MutationRequest
  ): Promise<MutationResponse> {
    return do_mutation(configuration, state, request);
  },

  /**
   * Check the health of the connector.
   *
   * For example, this function should check that the connector
   * is able to reach its data source over the network.
   * @param configuration
   * @param state
   */
  healthCheck(_: Configuration, __: State): Promise<undefined> {
    // TODO
    // https://qdrant.github.io/qdrant/redoc/index.html#tag/service/operation/healthz
    return Promise.resolve(undefined);
  },

  /**
   *
   * Update any metrics from the state
   *
   * Note: some metrics can be updated directly, and do not
   * need to be updated here. This function can be useful to
   * query metrics which cannot be updated directly, e.g.
   * the number of idle connections in a connection pool
   * can be polled but not updated directly.
   * @param configuration
   * @param state
   */
  fetchMetrics(_: Configuration, __: State): Promise<undefined> {
    // TODO: Metrics
    // https://qdrant.github.io/qdrant/redoc/index.html#tag/service/operation/metrics
    return Promise.resolve(undefined);
  },
};

start(connector);
