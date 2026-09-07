import fs from 'fs';
import { parse } from '@babel/parser';

try {
  const code = fs.readFileSync('src/components/SellerPanel.jsx', 'utf-8');
  parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log('No syntax errors.');
} catch (e) {
  console.error('Syntax error:', e);
}
