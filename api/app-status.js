export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Uygulama durumu - her zaman aktif dönsün
    const appStatus = {
      status: 'active',
      maintenance: false,
      latestVersion: '1.0.0',
      minVersion: '1.0.0',
      message: 'Uygulama sorunsuz çalışıyor'
    };

    res.status(200).json(appStatus);
  } catch (error) {
    console.error('Error fetching app status:', error);
    res.status(200).json({
      status: 'active',
      maintenance: false,
      latestVersion: '1.0.0',
      minVersion: '1.0.0',
      message: 'Uygulama sorunsuz çalışıyor'
    });
  }
}