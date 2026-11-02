# AWS architecture diagrams

Conventions for AWS-style architecture diagrams - dashed account/domain boundaries, AWS service icons, and semantic data-flow arrow colors. Layers on top of the general container/edge rules in SKILL.md. Worked example: `examples/architecture-ccmt-ai.drawio`.

## Dashed boundary containers

AWS diagrams group resources in nested dashed boxes with a top-aligned title; the border color signals the tier.

- **Account / VPC** - blue `#147EBA`, `strokeWidth=2`, `dashPattern=8 4`
- **Domain / service group** - slate `#5A6C86` (or green `#7AA116`), `strokeWidth=1`, `dashPattern=6 3`
- **Legend / notes** - gold `#D4A843`

```xml
<!-- Account-level boundary (blue, thicker) -->
<mxCell id="acct" value="Account Name" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#147EBA;strokeWidth=2;dashed=1;dashPattern=8 4;verticalAlign=top;fontStyle=1;fontSize=14;spacingTop=8;fontColor=#147EBA;" vertex="1" parent="1">
  <mxGeometry x="40" y="60" width="200" height="180" as="geometry" />
</mxCell>

<!-- Inner domain (slate, thinner) -->
<mxCell id="domain" value="Domain Name" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#EFF0F3;strokeColor=#5A6C86;strokeWidth=1;dashed=1;dashPattern=6 3;verticalAlign=top;fontStyle=1;fontSize=12;spacingTop=6;fontColor=#5A6C86;" vertex="1" parent="1">
  <mxGeometry x="60" y="100" width="160" height="120" as="geometry" />
</mxCell>
```

Prefer real parent-child containment (children `parent="acct"`, coordinates relative to the container) over stacking shapes on a bigger shape - see SKILL.md "Containers and groups".

## AWS service icons

Do NOT hardcode a `resIcon` guess - a wrong name renders blank. Run `jupyterlab-drawio shapes "<service>"` for the exact `shape=mxgraph.aws4.resourceIcon;resIcon=...` style + size. Common services: `eventbridge`, `sqs`, `lambda`, `dynamodb`, `s3`, `kinesis_data_firehose`, `glue`, `api_gateway`, `cloudwatch_2`, `secrets_manager`.

Size icons 60x60 with the label below - `verticalLabelPosition=bottom;verticalAlign=top`.

## Semantic data-flow arrow colors

Color each edge by what the flow means:

| Meaning | strokeColor | Style |
|---|---|---|
| Standard data flow | `#666666` gray | solid |
| Scheduler / trigger | `#f59e0b` amber | solid |
| Query / read | `#3b82f6` blue | solid |
| Database write | `#a855f7` purple | solid |
| Error path / DLQ | `#ef4444` red | `dashed=1` |

Keep `edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto` on every edge (SKILL.md edge rules). For parallel edges into one target, stack entry points vertically (`entryY=0.25, 0.5, 0.75`).

## Checklist

1. List AWS services + external systems
2. Group into account / domain boundaries
3. Left-to-right primary flow
4. Stack parallel connections at distinct entry points
5. Size boundaries to fit children plus margin
6. Legend outside the main diagram area
