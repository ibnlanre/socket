import { useState } from "react";

import { SocketClient } from "./socket-client";
import type { SocketConstructor } from "./types/socket-constructor";
import type { SocketParams } from "./types/socket-params";

export function createSocket<
  Get = unknown,
  Params extends SocketParams = {},
  Post = never
>(configuration: SocketConstructor) {
  return new SocketClient<Get, Params, Post>(configuration);
}

const client = createSocket<SecurityList>({
  url: "/v2/api/orders",
  baseURL: "ws://localhost:8080",
  cacheName: "ovs-socket",
});

type SecurityList = {
  code: string;
  name: string;
  image_link: string;
  security_type: string;
  board_code: string;
  is_tradable: string;
  can_be_sold: string;
  can_be_bought: string;
  board_name: string;
};

client.open({
  currency_code: "NGN",
  security_code: "AAPL",
  board_code: "NGSE",
});

interface OvsSocket {
  currency_code: string | null;
  security_code: string | null;
  board_code: string | null;
}

function useOvsSocket() {
  const [currencyCode, setCurrencyCode] = useState<string>("NGN");
  const [securityCode, setSecurityCode] = useState<string | null>(null);
  const [boardCode, setBoardCode] = useState<string | null>(null);

  const params = {
    currency_code: currencyCode,
    security_code: securityCode,
    board_code: boardCode,
  };
}
