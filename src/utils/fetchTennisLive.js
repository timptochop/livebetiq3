// src/utils/fetchTennisLive.js
import axios from 'axios';

const fetchTennisLive = async () => {
  try {
    const response = await axios.get('/api/gs/tennis-live');
    const data = response.data?.matches || [];

    return data.flatMap(category => category.match || []);
  } catch (error) {
    console.error('❌ fetchTennisLive API error:', error.message);
    return [];
  }
};

export default fetchTennisLive;