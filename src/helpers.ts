import { Apparel } from "./services/otp.entity";
import * as fs from 'fs';

const filePath = './data/stock.json';

export const readStockData = () => {
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
};

export const  writeStockData = (stock: Apparel[]) => {
  fs.writeFileSync(filePath, JSON.stringify(stock, null, 2));
};