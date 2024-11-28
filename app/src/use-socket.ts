// use = (url: string, params?: SocketParams) => {
//   const [data, setData] = useState<Get>();
//   const parameters = this.#getDependencies(params);

//   useEffect(() => {
//     return this.connect(url, setData, params);
//   }, [url, ...parameters]);

//   return {
//     data,
//     status: this.status,
//     fetchStatus: this.fetchStatus,
//   };
// };

// function useSocket<
//   Get extends unknown,
//   Params extends never,
//   Post extends never
// >(socket: SocketClient<Get, Params, Post>) {
//   const [data, setData] = useState<Get>();

//   useEffect(() => {
//     const { open, close, error } = socket.log;

//     const cache = new CacheManager()
//   }, []);

//   return {};
// }
