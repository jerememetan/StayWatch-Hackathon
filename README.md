# StayWatch

StayWatch is a safety-first hackathon MVP for helping property managers review **potential** short-stay occupancy indicators. It combines synthetic building records with an optional OpenAI + Exa investigation, and always presents evidence as context for human review—not a conclusion about any resident or visitor.

## Demo path

1. Open the dashboard.
2. Select **#18-04** from the potential-indicator review queue.
3. Select **Start investigation**.
4. Watch the completed tool timeline replay, then review the case report's potential indicators, supporting evidence, uncertainty, and recommended human review.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional live investigation

Copy `.env.example` to `.env.local` and set both values:

```bash
OPENAI_API_KEY=your_key
EXA_API_KEY=your_key
```

With both keys, `POST /api/investigate` runs the OpenAI Responses API function-calling loop and uses Exa for public-web leads. Without either key, the app stays fully demoable using a deterministic local investigation and visibly labels it **Demo evidence mode**.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Guardrails

- Signals and public-web results are potential indicators, not proof.
- The product does not accuse residents, make enforcement decisions, or submit reports.
- Every case report explicitly includes uncertainty and recommends human review.
