import { createSocketClient } from "../dist";

type MarketSummaryOverview = {
  last_update_on: string;
  messages: {
    summary: {
      status: string;
      last_update_on: string;
      messages: {
        total_securities: string;
        number_of_participants: string;
        number_of_traded_volumes_in_kg: string;
        number_of_traded_volumes_in_mt: string;
        listed_contracts: string;
        boards: Array<{
          name: string;
          code: string;
          description: string;
          order_type: Array<any>;
          security_counts: string;
        }>;
      };
      is_post_connection: string;
    };
  };
};

type MarketSummaryOverviewParams = {
  currency_code?: string;
};

const client = createSocketClient<
  MarketSummaryOverview,
  MarketSummaryOverviewParams
>({
  baseURL: "wss://ovs.int.afex.dev/",
  url: "/ws/oms-streams/market_summary_overview/dp/3N9sDl0cUoaDdj91PD5etwaa/af5833befd001fde2796b8f9f3fd272c3109f52a268050b1d2d49c737942efeb/515904093967367709",
});

const { data } = client.use({ currency_code: "NGN" }, (data) => {
  if (!data) return;
  return data.messages.summary.status;
});
