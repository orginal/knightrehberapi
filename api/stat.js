export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, action, timestamp, appVersion, platform } = req.body;

    // İstatistikleri logla (gerçek uygulamada veritabanına kaydedin)
    console.log('App Stats:', {
      userId,
      action,
      timestamp,
      appVersion,
      platform,
      receivedAt: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Stats recorded successfully'
    });
  } catch (error) {
    console.error('Error recording stats:', error);
    res.status(200).json({
      success: true,
      message: 'Stats recorded (fallback)'
    });
  }
}