import { Router, Response } from 'express';
import { query } from '../config/database';
import { validate } from '../middleware/validate';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { InboundMessageSchema, OutboundMessageSchema } from '../types/schemas';
import { processInboundMessage } from '../services/messageService';

const router = Router();
router.use(authMiddleware);

// POST /api/messages/inbound — receive a new candidate message → triggers AI pipeline
router.post('/inbound', validate(InboundMessageSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { application_id, thread_id, message_body, sender_email, channel,
            external_message_id, reply_to_message_id } = req.body;

    // If no thread_id provided, find or create one
    let resolvedThreadId = thread_id;
    if (!resolvedThreadId) {
      const tRes = await query(
        `SELECT thread_id FROM conversation_threads WHERE application_id = $1 AND channel = $2 LIMIT 1`,
        [application_id, channel || 'email']
      );
      if (tRes.rows.length) {
        resolvedThreadId = tRes.rows[0].thread_id;
      } else {
        const newThread = await query(
          `INSERT INTO conversation_threads (application_id, channel) VALUES ($1,$2) RETURNING thread_id`,
          [application_id, channel || 'email']
        );
        resolvedThreadId = newThread.rows[0].thread_id;
      }
    }

    const result = await processInboundMessage({
      applicationId: application_id,
      threadId: resolvedThreadId,
      messageBody: message_body,
      senderEmail: sender_email,
      externalMessageId: external_message_id,
      replyToMessageId: reply_to_message_id,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('[messages] POST /inbound:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages/outbound — recruiter sends a message
router.post('/outbound', validate(OutboundMessageSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { thread_id, message_body, subject, draft_id } = req.body;

    const result = await query(
      `INSERT INTO messages (thread_id, direction, sender_type, recruiter_id, message_body)
       VALUES ($1,'outbound','recruiter',$2,$3) RETURNING *`,
      [thread_id, req.recruiter!.recruiter_id, message_body]
    );
    const message = result.rows[0];

    await query(
      `UPDATE conversation_threads SET last_message_at = NOW(), thread_status = 'awaiting_candidate'
       WHERE thread_id = $1`,
      [thread_id]
    );

    if (draft_id) {
      await query(
        `UPDATE reply_drafts SET draft_status = 'sent', sent_at = NOW(), sent_message_id = $1
         WHERE draft_id = $2`,
        [message.message_id, draft_id]
      );
    }

    // Also mark the subject on the thread if provided
    if (subject) {
      await query(
        `UPDATE conversation_threads SET subject = $1 WHERE thread_id = $2`,
        [subject, thread_id]
      );
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('[messages] POST /outbound:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages/threads/application/:applicationId — get thread_id for an application
router.get('/threads/application/:applicationId', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT thread_id, channel, thread_status, started_at, last_message_at
       FROM conversation_threads
       WHERE application_id = $1
       ORDER BY started_at ASC`,
      [req.params.applicationId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[messages] GET /threads/application/:applicationId:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages/thread/:threadId — conversation history
router.get('/thread/:threadId', async (req: AuthRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const result = await query(
      `SELECT m.*, r.full_name AS recruiter_name
       FROM messages m
       LEFT JOIN recruiters r ON r.recruiter_id = m.recruiter_id
       WHERE m.thread_id = $1
       ORDER BY m.sent_at ASC`,
      [threadId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[messages] GET /thread/:threadId:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/messages/:messageId/analysis — get AI analysis for a message
router.get('/:messageId/analysis', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM message_analyses WHERE message_id = $1`, [req.params.messageId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Analysis not found' }) as unknown as void;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[messages] GET /:messageId/analysis:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
