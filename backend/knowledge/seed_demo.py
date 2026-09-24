"""Seed the Apex Field Services knowledge base with HVAC field-ops content.

Run once before the demo:
    python -m backend.knowledge.seed_demo
"""

from __future__ import annotations

import logging
import sys

from backend.pipeline.research import ResearchStage
from backend.tenants.loader import default_tenant

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TENANT_ID = "apex-field-services"

DOCUMENTS: list[dict] = [
    # ── Emergency response ────────────────────────────────────────────────────
    {
        "source": "ops-manual/emergency-response",
        "content": (
            "Emergency HVAC calls (no heat/no cool in extreme weather, gas leak, carbon monoxide) "
            "are classified Priority 1. Dispatch a technician within 2 hours. "
            "Notify the on-call supervisor immediately. Do not defer emergency calls."
        ),
    },
    {
        "source": "ops-manual/emergency-response",
        "content": (
            "After-hours emergency call procedure: (1) Verify emergency classification with caller, "
            "(2) Page on-call tech via the dispatch system, (3) Create a P1 work order, "
            "(4) Call customer back within 15 minutes to confirm ETA."
        ),
    },
    {
        "source": "ops-manual/emergency-response",
        "content": (
            "Carbon monoxide or gas leak: advise customer to evacuate immediately and call 911. "
            "Do not dispatch HVAC technician until fire department clears the site. "
            "Create an incident report and notify the safety officer."
        ),
    },
    # ── Work order creation ───────────────────────────────────────────────────
    {
        "source": "ops-manual/work-orders",
        "content": (
            "Work order required fields: customer name, site address, equipment type, "
            "reported symptom, priority level (P1/P2/P3), preferred appointment window, "
            "and assigned technician. Open in the dispatch system before committing an ETA."
        ),
    },
    {
        "source": "ops-manual/work-orders",
        "content": (
            "Priority levels: P1 = emergency (2-hour response), P2 = urgent (next business day), "
            "P3 = routine (within 5 business days). Maintenance contract customers are upgraded "
            "one priority level automatically."
        ),
    },
    {
        "source": "ops-manual/work-orders",
        "content": (
            "Scheduling Thursday appointments: verify technician availability in the dispatch board. "
            "Morning slots (8am-12pm) fill first. Afternoon slots (1pm-5pm) are usually available "
            "for P2/P3 calls booked by Tuesday noon."
        ),
    },
    # ── HVAC systems and common failures ─────────────────────────────────────
    {
        "source": "technical/hvac-systems",
        "content": (
            "Split system HVAC (most residential): separate indoor air handler and outdoor condenser. "
            "Common failures: refrigerant leak, dirty evaporator coil, failed capacitor, "
            "clogged drain line, thermostat malfunction. Average repair time: 1.5–3 hours."
        ),
    },
    {
        "source": "technical/hvac-systems",
        "content": (
            "Packaged unit HVAC (commercial rooftop): all components in one cabinet. "
            "Common failures: compressor failure, heat exchanger crack, blower motor. "
            "Requires roof access — confirm ladder/lift availability before dispatch."
        ),
    },
    {
        "source": "technical/hvac-systems",
        "content": (
            "No cooling symptoms: check thermostat setting, air filter, circuit breaker, "
            "outdoor unit power, and refrigerant charge. A frozen evaporator coil indicates "
            "low refrigerant or restricted airflow — do not run system until diagnosed."
        ),
    },
    {
        "source": "technical/hvac-systems",
        "content": (
            "No heat symptoms: for heat pumps, check if outdoor unit is running (may be in defrost). "
            "For gas furnaces, check pilot light, igniter, and gas supply. "
            "Electric furnaces: check heating elements and sequencers."
        ),
    },
    {
        "source": "technical/hvac-systems",
        "content": (
            "Unusual noises: banging/clanking = loose parts or blower wheel; "
            "squealing = belt or bearing failure; hissing = refrigerant or duct leak; "
            "rattling = debris in system. All require tech inspection — do not ignore."
        ),
    },
    # ── SLA and maintenance contracts ─────────────────────────────────────────
    {
        "source": "contracts/sla",
        "content": (
            "Standard maintenance contract (Gold): includes 2 preventive maintenance visits/year, "
            "priority dispatch (P2 upgrade to P1), 10% parts discount, no after-hours surcharge."
        ),
    },
    {
        "source": "contracts/sla",
        "content": (
            "Service level agreement response times: P1 emergency — 2 hours; "
            "P2 urgent — next business day by noon; P3 routine — within 5 business days. "
            "SLA clock starts when the work order is created, not when the call is received."
        ),
    },
    {
        "source": "contracts/sla",
        "content": (
            "After-hours surcharge: $75 for P2/P3 calls outside 7am-6pm Mon-Fri and all day Sat/Sun. "
            "P1 emergency calls and Gold contract customers are exempt from the surcharge."
        ),
    },
    # ── Technician dispatch ───────────────────────────────────────────────────
    {
        "source": "ops-manual/dispatch",
        "content": (
            "Technician assignment: match technician zone to job site. "
            "North zone: Techs 1-4. South zone: Techs 5-8. Commercial only: Techs 9-12. "
            "Unassigned calls show as yellow in the dispatch board."
        ),
    },
    {
        "source": "ops-manual/dispatch",
        "content": (
            "Tech en route: system sends automated SMS to customer with tech name and ETA. "
            "If ETA changes by more than 30 minutes, dispatcher must call customer. "
            "Always confirm customer contact number is current before dispatch."
        ),
    },
    {
        "source": "ops-manual/dispatch",
        "content": (
            "Parts needed before dispatch: check parts inventory in the system. "
            "If a common part (capacitor, contactor, filter) is needed, add to the work order. "
            "Special order parts: notify customer of 2-5 day lead time before scheduling."
        ),
    },
    # ── Parts and inventory ───────────────────────────────────────────────────
    {
        "source": "inventory/parts",
        "content": (
            "High-turnover parts kept in stock: run capacitors (5-70 MFD range), "
            "contactors (30A/40A), 1-4 inch air filters (standard sizes), "
            "dual-run capacitors, 24V transformers, thermostat wire."
        ),
    },
    {
        "source": "inventory/parts",
        "content": (
            "Refrigerant: R-410A available at the warehouse. R-22 (legacy) requires special order "
            "and EPA certification. All refrigerant handling must follow EPA 608 regulations. "
            "Log refrigerant usage in the system after every service call."
        ),
    },
    # ── Customer communication ────────────────────────────────────────────────
    {
        "source": "customer-service/communication",
        "content": (
            "Customer expectation setting: always confirm the appointment window (not exact time). "
            "Provide a 2-4 hour arrival window. Send a confirmation email or SMS after booking. "
            "Tech will call 30 minutes before arrival."
        ),
    },
    {
        "source": "customer-service/communication",
        "content": (
            "Complaint escalation: if customer is upset with response time or technician, "
            "escalate to the operations manager within the same business day. "
            "Offer to waive the service call fee for P1 delays beyond SLA."
        ),
    },
    {
        "source": "customer-service/communication",
        "content": (
            "Preventive maintenance reminder script: 'Your annual AC tune-up is due this month. "
            "A PM visit catches issues before summer peak — would you like to schedule?' "
            "Target March-April for cooling season prep, October for heating season prep."
        ),
    },
    # ── Seasonality and common scenarios ─────────────────────────────────────
    {
        "source": "ops-manual/seasonality",
        "content": (
            "Summer peak (June-August): call volume increases 3x. Add P1/P2 overflow techs "
            "from the partner network. Minimum 4 on-call techs during heat advisories. "
            "Pre-stage high-demand parts (capacitors, refrigerant) at start of season."
        ),
    },
    {
        "source": "ops-manual/seasonality",
        "content": (
            "System not cooling after winter storage: likely causes are low refrigerant "
            "(check for leaks first), failed capacitor (start-of-season failure), "
            "or dirty condenser coil. Standard spring startup check covers all three."
        ),
    },
    {
        "source": "ops-manual/scenarios",
        "content": (
            "Broken HVAC with tenant present: prioritize P1/P2 classification. "
            "Coordinate access with property manager if tenant cannot grant entry. "
            "Always get written authorization before accessing mechanical rooms."
        ),
    },
]


def seed(tenant_id: str = TENANT_ID) -> None:
    stage = ResearchStage()
    collection = stage._get_collection(tenant_id)

    if collection.count() > 0:
        logger.info("Collection %s already has %d documents — skipping seed", collection.name, collection.count())
        return

    stage.ingest(DOCUMENTS, tenant_id=tenant_id)
    logger.info("Seeded %d documents into %s", len(DOCUMENTS), collection.name)


if __name__ == "__main__":
    tenant = default_tenant()
    seed(tenant.tenant_id)
    print(f"Done. Knowledge base ready for tenant '{tenant.name}'.")
    sys.exit(0)
