export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const nostaljiFotograflar = [
      {
        id: 'k1',
        title: 'Eski Knight Online 1',
        image: 'ko1.jpg',
        description: 'Knight Online\'ın ilk yıllarından bir görüntü'
      },
      {
        id: 'k2',
        title: 'Eski Knight Online 2',
        image: 'ko2.jpg',
        description: 'Moradon\'un eski hali'
      }
    ];

    res.status(200).json(nostaljiFotograflar);
  } catch (error) {
    console.error('Error fetching nostalgia photos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}