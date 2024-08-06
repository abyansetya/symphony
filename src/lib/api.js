import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HEADERS } from './header.js';


const fetchProxies = async (url) => {
  try {
    const { data } = await axios.get(url);
    return data.split("\n").filter((proxy) => proxy.trim() !== "");
  } catch (error) {
    console.error("❌ Error fetching proxies:", error.message);
    return [];
  }
};

function parseProxy(proxy) {
  const parts = proxy.split(":");
  if (parts.length === 4) {
    const [username, password, host, port] = parts;
    return { username: username, password: password, host: host, port: port };
  } else if (parts.length === 2) {
    const [host, port] = parts;
    return { host: host, port: port };
  } else throw new Error("Invalid proxy format: " + proxy);
}

const getFaucet = async (address, proxy) => {
  try {
    const axiosInstance = axios.create({
      httpsAgent: new HttpsProxyAgent(proxy),
      headers: HEADERS,
      timeout: 5000,
    });
    const { data } = await axiosInstance({
      url: `https://faucet.ping.pub/symphony/send/${address}`,
      method: "GET",
    });
    return { data, proxy };
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      console.error(`❌ Timeout error with proxy ${proxy}`);
    } else {
      console.error(`❌ Error with proxy ${proxy}:`, error.message);
    }
    throw error;
  }
};

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

export { fetchProxies, getFaucet, shuffleArray, parseProxy };
