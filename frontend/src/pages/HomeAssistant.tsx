import { useEffect, useState } from "react";
import { Cpu, Copy, Check, Play, ChevronDown, ChevronRight } from "lucide-react";
import { fetchHASensors, fetchHAMQTTConfig, type HASensors, type MQTTConfig } from "../api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      className="btn btn-ghost"
      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", position: "absolute", top: "0.5rem", right: "0.5rem" }}
      onClick={handleCopy}
    >
      {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div style={{ position: "relative", marginBottom: "1rem" }}>
      <CopyButton text={code} />
      {language && (
        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", padding: "0.5rem 0.75rem 0", background: "#0d0f14", borderRadius: "6px 6px 0 0", border: "1px solid var(--border)", borderBottom: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {language}
        </div>
      )}
      <pre style={{
        background: "#0d0f14",
        border: "1px solid var(--border)",
        borderRadius: language ? "0 0 6px 6px" : "6px",
        padding: "0.75rem",
        paddingRight: "4rem",
        overflow: "auto",
        fontSize: "0.8125rem",
        lineHeight: "1.5",
        color: "#c9d1d9",
        margin: 0,
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CollapsibleSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", userSelect: "none" }}
      >
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      {open && <div style={{ marginTop: "1rem" }}>{children}</div>}
    </div>
  );
}

const APP_BASE_URL = `${window.location.protocol}//${window.location.host}`;

const REST_SENSOR_YAML = `# configuration.yaml
rest:
  - resource: ${APP_BASE_URL}/api/ha/sensors
    scan_interval: 300
    sensor:
      - name: "Home Maintenance Overdue"
        value_template: "{{ value_json.overdue_total }}"
        unit_of_measurement: "tasks"
        icon: mdi:alert-circle
      - name: "Home Maintenance Due Today"
        value_template: "{{ value_json.due_today_total }}"
        unit_of_measurement: "tasks"
        icon: mdi:calendar-today
      - name: "Home Maintenance Upcoming 7d"
        value_template: "{{ value_json.upcoming_7d_total }}"
        unit_of_measurement: "tasks"
        icon: mdi:calendar-week
      - name: "Home Maintenance Open Repairs"
        value_template: "{{ value_json.open_repairs }}"
        unit_of_measurement: "repairs"
        icon: mdi:wrench
      - name: "Home Maintenance Monthly Cost"
        value_template: "{{ value_json.total_monthly_cost }}"
        unit_of_measurement: "$"
        icon: mdi:currency-usd
      - name: "Home Maintenance Low Stock"
        value_template: "{{ value_json.low_stock_supplies }}"
        unit_of_measurement: "items"
        icon: mdi:package-variant
      - name: "Home Maintenance Next Task"
        value_template: >-
          {% if value_json.next_task %}
            {{ value_json.next_task.name }}
          {% else %}
            None
          {% endif %}
        icon: mdi:clipboard-check

  - resource: ${APP_BASE_URL}/api/ha/sensors
    scan_interval: 300
    binary_sensor:
      - name: "Home Maintenance Has Overdue"
        value_template: "{{ value_json.overdue_total > 0 }}"
        device_class: problem
        icon: mdi:home-alert`;

const REST_COMMAND_YAML = `# configuration.yaml
rest_command:
  home_maintenance_complete:
    url: "${APP_BASE_URL}/api/ha/webhook"
    method: POST
    content_type: "application/json"
    payload: '{"action": "complete", "task_id": {{ task_id }}}'
  home_maintenance_snooze:
    url: "${APP_BASE_URL}/api/ha/webhook"
    method: POST
    content_type: "application/json"
    payload: '{"action": "snooze", "task_id": {{ task_id }}, "days": {{ days | default(7) }}}'
  home_maintenance_digest:
    url: "${APP_BASE_URL}/api/ha/webhook"
    method: POST
    content_type: "application/json"
    payload: '{"action": "send_digest"}'`;

const WEBHOOK_AUTOMATION_NFC = `# automations.yaml
- alias: "Complete maintenance task via NFC"
  trigger:
    - platform: tag
      tag_id: !secret nfc_furnace_filter_tag
  action:
    - service: rest_command.home_maintenance_complete
      data:
        task_id: 1  # Replace with your task ID`;

const WEBHOOK_AUTOMATION_DIGEST = `# automations.yaml
- alias: "Daily maintenance digest at 8am"
  trigger:
    - platform: time
      at: "08:00:00"
  condition:
    - condition: time
      weekday:
        - mon
        - wed
        - fri
  action:
    - service: rest_command.home_maintenance_digest`;

const WEBHOOK_AUTOMATION_OVERDUE = `# automations.yaml
- alias: "Alert when maintenance tasks overdue"
  trigger:
    - platform: state
      entity_id: binary_sensor.home_maintenance_has_overdue
      to: "on"
  action:
    - service: notify.mobile_app_your_phone
      data:
        title: "Home Maintenance"
        message: >-
          You have {{ states('sensor.home_maintenance_overdue') }}
          overdue maintenance task(s)!
        data:
          url: "${APP_BASE_URL}"`;

export default function HomeAssistant() {
  const [sensors, setSensors] = useState<HASensors | null>(null);
  const [mqttConfig, setMqttConfig] = useState<MQTTConfig | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  useEffect(() => {
    fetchHAMQTTConfig().then(setMqttConfig).catch(() => {});
  }, []);

  async function handleTestConnection() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const data = await fetchHASensors();
      setSensors(data);
      setTestResult("success");
    } catch (e: unknown) {
      setTestResult(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setTestLoading(false);
    }
  }

  function generateMQTTPublishCommands(): string {
    if (!mqttConfig) return "Loading MQTT config...";
    return mqttConfig.configs
      .map(
        (c) =>
          `mosquitto_pub -h YOUR_MQTT_BROKER -t '${c.topic}' -m '${JSON.stringify(c.payload)}' -r`
      )
      .join("\n\n");
  }

  return (
    <div>
      <div className="page-header">
        <h1>
          <Cpu size={24} style={{ verticalAlign: "middle", marginRight: "0.5rem" }} />
          Home Assistant Integration
        </h1>
      </div>

      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", fontSize: "0.875rem", lineHeight: "1.6" }}>
        Integrate your home maintenance tracker with Home Assistant using REST sensors, webhooks, and MQTT discovery.
        Copy the YAML snippets below into your Home Assistant configuration.
      </p>

      {/* Test Section */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3>Test Connection</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <button className="btn btn-primary" onClick={handleTestConnection} disabled={testLoading}>
            <Play size={16} /> {testLoading ? "Testing..." : "Test Connection"}
          </button>
          {testResult === "success" && (
            <span style={{ color: "var(--success)", fontSize: "0.875rem" }}>Connected successfully</span>
          )}
          {testResult && testResult !== "success" && (
            <span style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{testResult}</span>
          )}
        </div>

        {sensors && (
          <div className="grid-3" style={{ gap: "0.75rem" }}>
            <div style={{ background: "var(--bg)", borderRadius: "6px", padding: "0.75rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: sensors.overdue_total > 0 ? "var(--danger)" : "var(--success)" }}>
                {sensors.overdue_total}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Overdue</div>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: "6px", padding: "0.75rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: sensors.due_today_total > 0 ? "var(--warning)" : "var(--text)" }}>
                {sensors.due_today_total}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Due Today</div>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: "6px", padding: "0.75rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)" }}>
                {sensors.upcoming_7d_total}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Upcoming 7d</div>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: "6px", padding: "0.75rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{sensors.open_repairs}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Open Repairs</div>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: "6px", padding: "0.75rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>${sensors.total_monthly_cost.toFixed(0)}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Monthly Cost</div>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: "6px", padding: "0.75rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{sensors.low_stock_supplies}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Low Stock</div>
            </div>
            {sensors.next_task && (
              <div style={{ background: "var(--bg)", borderRadius: "6px", padding: "0.75rem", gridColumn: "span 3" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>Next: {sensors.next_task.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Due {sensors.next_task.due} ({sensors.next_task.category})
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* REST Sensor Setup */}
      <CollapsibleSection title="REST Sensor Setup" defaultOpen>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1rem" }}>
          Add these REST sensors to your <code style={{ color: "var(--accent)" }}>configuration.yaml</code> to pull data from the maintenance app.
          The single <code style={{ color: "var(--accent)" }}>/api/ha/sensors</code> endpoint provides all data in one call.
        </p>
        <CodeBlock code={REST_SENSOR_YAML} language="yaml" />

        <h4 style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "1.5rem", marginBottom: "0.75rem" }}>
          REST Commands (for webhooks)
        </h4>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1rem" }}>
          These REST commands let you complete or snooze tasks from HA automations and scripts.
        </p>
        <CodeBlock code={REST_COMMAND_YAML} language="yaml" />
      </CollapsibleSection>

      {/* Webhook Setup */}
      <CollapsibleSection title="Webhook Automation Examples">
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1rem" }}>
          The webhook endpoint at <code style={{ color: "var(--accent)" }}>/api/ha/webhook</code> accepts
          POST requests with actions: <code style={{ color: "var(--accent)" }}>complete</code>,{" "}
          <code style={{ color: "var(--accent)" }}>snooze</code>, and{" "}
          <code style={{ color: "var(--accent)" }}>send_digest</code>.
        </p>

        <h4 style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Complete task when NFC tag scanned
        </h4>
        <CodeBlock code={WEBHOOK_AUTOMATION_NFC} language="yaml" />

        <h4 style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Send digest on a schedule
        </h4>
        <CodeBlock code={WEBHOOK_AUTOMATION_DIGEST} language="yaml" />

        <h4 style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Alert on overdue tasks
        </h4>
        <CodeBlock code={WEBHOOK_AUTOMATION_OVERDUE} language="yaml" />
      </CollapsibleSection>

      {/* MQTT Setup */}
      <CollapsibleSection title="MQTT Discovery Setup">
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1rem" }}>
          MQTT discovery lets Home Assistant automatically create sensor entities when you publish
          config payloads to the discovery topics. This app generates the payloads -- you publish
          them to your MQTT broker.
        </p>

        <h4 style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          How it works
        </h4>
        <ol style={{ color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: "1.8", paddingLeft: "1.25rem", marginBottom: "1rem" }}>
          <li>Publish each discovery config payload to its topic (retained)</li>
          <li>Home Assistant auto-creates the sensor entities</li>
          <li>Your automation/script publishes state updates to the state topics</li>
          <li>Alternatively, use the REST sensors above (simpler, no MQTT needed)</li>
        </ol>

        <h4 style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Publish commands
        </h4>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginBottom: "1rem" }}>
          Run these <code style={{ color: "var(--accent)" }}>mosquitto_pub</code> commands to register all sensors.
          Replace <code style={{ color: "var(--accent)" }}>YOUR_MQTT_BROKER</code> with your broker address.
        </p>
        <CodeBlock code={generateMQTTPublishCommands()} language="bash" />

        {mqttConfig && (
          <>
            <h4 style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "1.5rem", marginBottom: "0.75rem" }}>
              Discovery payloads ({mqttConfig.configs.length} sensors)
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {mqttConfig.configs.map((c, i) => (
                <details key={i} style={{ background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <summary style={{ padding: "0.5rem 0.75rem", cursor: "pointer", fontSize: "0.8125rem", color: "var(--text)" }}>
                    {c.topic}
                  </summary>
                  <div style={{ padding: "0 0.75rem 0.75rem" }}>
                    <CodeBlock code={JSON.stringify(c.payload, null, 2)} language="json" />
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* API Reference */}
      <CollapsibleSection title="API Reference">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[
            { method: "GET", path: "/api/ha/sensors", desc: "All sensor data in one call" },
            { method: "GET", path: "/api/ha/sensors/overdue", desc: "Just the overdue count" },
            { method: "GET", path: "/api/ha/sensors/category/{category}", desc: "Overdue count for a category" },
            { method: "POST", path: "/api/ha/webhook", desc: "Webhook receiver for automations" },
            { method: "GET", path: "/api/ha/mqtt-config", desc: "MQTT discovery payloads" },
            { method: "GET", path: "/api/tasks/ha-sensor", desc: "Legacy sensor (backwards compat)" },
          ].map((ep) => (
            <div key={ep.path} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", background: "var(--bg)", borderRadius: "6px" }}>
              <span style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                padding: "0.125rem 0.375rem",
                borderRadius: "4px",
                background: ep.method === "POST" ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.15)",
                color: ep.method === "POST" ? "var(--warning)" : "var(--accent)",
                fontFamily: "monospace",
              }}>
                {ep.method}
              </span>
              <code style={{ fontSize: "0.8125rem", color: "var(--text)" }}>{ep.path}</code>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>{ep.desc}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

    </div>
  );
}
