#!/bin/bash
set -e

# Format storage if needed
/opt/bitnami/kafka/bin/kafka-storage.sh format -t $(/opt/bitnami/kafka/bin/kafka-storage.sh random-uuid) -c /opt/bitnami/kafka/config/kraft/server.properties

# Start Kafka in KRaft mode
exec /opt/bitnami/kafka/bin/kafka-server-start.sh /opt/bitnami/kafka/config/kraft/server.properties