// src/utils/fetchTennisLive.js
import axios from 'axios';

export async function fetchTennisPredictions() {
  try {
    const response = await axios.get('/api/predictions');
    const data = response.data?.matches || [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('❌ fetchTennisPredictions API error:', error.message);
    return [];
  }
}