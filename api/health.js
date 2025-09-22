export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    ok: true,
    node: process.version,
    envs: {
      PUBLIC: !!process.env.WEB_PUSH_VAPID_PUBLIC_KEY,
      PRIVATE: !!process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
      CONTACT: !!process.env.PUSH_CONTACT
    }
  });
}