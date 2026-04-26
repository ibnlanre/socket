import { z } from "zod";
import { createSocketClient } from "../dist";

const marketSummaryOverviewClient = createSocketClient({
  baseURL: "wss://example.com/",
  url: "/ws/market_summary_overview/",
  paramsSchema: z.object({
    currency_code: z.string().optional(),
  }),
  sendSchema: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("subscribe"),
      currency_code: z.string().optional(),
    }),
    z.object({
      type: z.literal("ping"),
    }),
  ]),
  messageSchema: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("summary"),
      data: z.object({
        last_update_on: z.string(),
        messages: z.object({
          summary: z.object({
            status: z.string(),
            last_update_on: z.string(),
            messages: z.object({
              total_securities: z.string(),
              number_of_participants: z.string(),
              number_of_traded_volumes_in_kg: z.string(),
              number_of_traded_volumes_in_mt: z.string(),
              listed_contracts: z.string(),
              boards: z.array(
                z.object({
                  name: z.string(),
                  code: z.string(),
                  description: z.string(),
                  order_type: z.array(z.unknown()),
                  security_counts: z.string(),
                })
              ),
            }),
            is_post_connection: z.string(),
          }),
        }),
      }),
    }),
    z.object({
      type: z.literal("error"),
      code: z.string(),
      message: z.string(),
    }),
  ]),
});

interface AppProps {
  currency_code?: string;
}

function socketOptions(currency_code?: string) {
  return marketSummaryOverviewClient.preset({
    enabled: Boolean(currency_code),
    params: { currency_code },
    initialData: "Message not received yet",
    select(message) {
      if (message.type === "error") {
        return `Error ${message.code}: ${message.message}`;
      } else return message.data.messages.summary.status;
    },
  });
}

export function App({ currency_code = "NGN" }: AppProps) {
  const options = socketOptions(currency_code);
  const marketSummaryOverview = marketSummaryOverviewClient.use(options);
  return <div>{marketSummaryOverview.data}</div>;
}
