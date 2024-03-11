#!/bin/bash

# Function to handle SIGTERM and SIGINT (graceful shutdown)
graceful_shutdown() {
    echo "Shutting down gracefully..."
    # Replace this with a command to gracefully shutdown your application, if necessary
    kill -SIGTERM "$pid"
    wait "$pid"
    exit 0
}

# Trap SIGTERM and SIGINT to call the graceful_shutdown function
trap 'graceful_shutdown' SIGTERM SIGINT

# Start the application in the background and save its PID
node ./dist/src/index.js serve --configuration=${HASURA_CONFIGURATION_DIRECTORY}/config.json --port $HASURA_CONNECTOR_PORT &
pid=$!

# Wait for the application or a signal
wait "$pid"
