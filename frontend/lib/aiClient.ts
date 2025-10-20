import axios from "axios";

const aiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AI_BASE_URL || 'http://localhost:5050',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default aiClient;


