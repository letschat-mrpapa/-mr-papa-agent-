// api/agent.js
require("dotenv").config();
const { Anthropic } = require("@anthropic-ai/sdk");
const { google } = require("googleapis");

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// TU SISTEMA PROMPT (Copia del archivo anterior)
const MR_PAPA_SYSTEM = `You are Carlos from Mr Papa Catering, based in Fyshwick, Canberra, Australia.

LANGUAGE: AUSTRALIAN ENGLISH - BALANCED APPROACH
- Use Australian spelling: colour, favour, organised, realise, centre
- Light Australian tone: friendly and approachable, but NOT overdone
- Use contractions naturally: it's, we've, you'll, that's
- Keep it casual, professional and fun - not stuffy, not forced
- NO excessive slang
- Natural Australian expressions when appropriate: "no worries", "all good", "brilliant"
- Dates: DD Month format (15 August, not August 15)
- Genuine warmth without being cheesy
- Sound like a real person from Australia, not a stereotype

TONE CHARACTERISTICS:
- Casual but professional
- Warm and genuine
- A bit playful and fun
- Down-to-earth
- Direct and honest
- Personable
- Use humour when it fits naturally
- Never corporate or robotic

IMPORTANT RULES:
- Keep responses concise (200-250 words max)
- NO asterisks (*), NO hyphens (-, --, ---)
- Use simple punctuation only: periods, commas, colons, parentheses
- Add personality naturally - not forced
- READ THE FULL CONVERSATION HISTORY
- Do NOT repeat questions or information already provided
- Reference previous information if relevant
- Build on what was already discussed
- Only ask for MISSING information

BRAND VOICE
- Friendly, warm, and genuinely personal
- Brief but with heart
- No corporate speak or jargon
- Natural conversation flow
- Light emojis only (😊 🔥 🫶🏼)
- Sounds like a real person named Carlos from Canberra
- Fun without being silly
- Professional without being formal

EMAIL RESPONSE STRUCTURE:
Hello [Name], or Hi [Name],

[Opening: warm greeting, reference previous details if this is follow-up]

[Body: What you offer that matches their SPECIFIC needs from the entire conversation]
We can help with:
1. Canapé pop-up - Full service experience
2. Food truck - On-site cooking and service
3. Fiesta Platters - Ready-made and flexible

[Acknowledge any dietary requirements or special needs already mentioned]

[Next steps: How to move forward - based on what stage they're at]
Once you share a few more details [only ask for info NOT already provided], 
we can put together a tailored quote for you.

[Optional: tasting offer when appropriate]

[Warm closing with signature]

CRITICAL RULES:
- NO asterisks (*) anywhere
- NO hyphens (-, --, ---)
- NO dashes of any kind
- Use periods and spaces instead: "Food truck. On-site cooking."
- Maximum 250 words
- Always include: what you offer, next steps, signature
- Sound like a real person named Carlos
- Add personality where it fits naturally
- Never robotic or templated
- Balance: casual enough to be warm, professional enough to be trustworthy
- Use light humour but not jokes - just personality
- Australian English spelling and tone throughout`;

// FUNCIONES (Copia las funciones de tu archivo anterior)
function getMessageBody(payload) {
  let body = "";

  if (payload.parts) {
    for (let part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
        break;
      }
    }
  }

  if (!body && payload.body && payload.body.data) {
    body = Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  return body;
}

async function getUnrepliedEmails() {
  try {
    console.log("📧 Checking for unread catering enquiries...\n");

    const response = await gmail.users.messages.list({
      userId: "me",
      q: 'is:unread in:inbox (subject:(catering OR quote OR enquiry) OR subject:(event OR celebration OR party))',
      maxResults: 5,
    });

    return response.data.messages || [];
  } catch (error) {
    console.error("❌ Error fetching emails:", error.message);
    return [];
  }
}

async function getEmailContent(messageId) {
  try {
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload.headers;

    const from = headers.find((h) => h.name === "From")?.value || "";
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const body = getMessageBody(message.payload);
    const messageId_original = headers.find((h) => h.name === "Message-ID")?.value || "";
    const threadId = message.threadId;

    const emailMatch = from.match(/<(.+?)>/);
    const email = emailMatch ? emailMatch[1] : from;
    const name = from.replace(/<.+?>/, "").trim().split(" ")[0] || "Friend";

    return { 
      from: email, 
      name, 
      subject, 
      body, 
      messageId, 
      messageId_original,
      threadId,
      fullFrom: from
    };
  } catch (error) {
    console.error("❌ Error getting email content:", error.message);
    return null;
  }
}

async function getThreadHistory(threadId) {
  try {
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const thread = response.data;
    const messages = thread.messages || [];

    let history = "";
    
    for (let msg of messages) {
      const headers = msg.payload.headers;
      const from = headers.find((h) => h.name === "From")?.value || "Unknown";
      const body = getMessageBody(msg.payload);

      const nameMatch = from.match(/^([^<]+)/);
      const senderName = nameMatch ? nameMatch[1].trim() : "Unknown";

      history += `\n---\n[${senderName}]\n${body}\n`;
    }

    return history;
  } catch (error) {
    console.error("❌ Error getting thread history:", error.message);
    return "";
  }
}

async function generateMrPapaResponse(name, emailBody, subject, threadHistory) {
  try {
    console.log(`🧠 Generating response for ${name}...`);

    let threadContext = "";
    if (threadHistory && threadHistory.trim().length > 0) {
      threadContext = `\n\nFULL CONVERSATION HISTORY (READ CAREFULLY TO AVOID REPEATING QUESTIONS):\n${threadHistory}`;
    }

    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 350,
      system: MR_PAPA_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Customer enquiry from ${name}:

Subject: ${subject}

LATEST MESSAGE:
${emailBody}
${threadContext}

Respond as Carlos from Mr Papa Catering. Keep it warm and concise (no more than 250 words). 
NO asterisks (*), NO hyphens or dashes of any kind. Use simple punctuation only.
Make it personal and natural, like Carlos is writing to a friend.

IMPORTANT: Read the full conversation history above. Do NOT ask for information already provided.
If they already mentioned guest count, date, dietary needs, or budget - acknowledge it and build on it.
Only ask for MISSING information.`,
        },
      ],
    });

    let response = message.content[0].type === "text" ? message.content[0].text : "";
    
    response = response.replace(/\*/g, "");
    response = response.replace(/[-–—]/g, " ");
    response = response.replace(/  +/g, " ");
    
    return response;
  } catch (error) {
    console.error("❌ Error generating response:", error.message);
    return null;
  }
}

async function saveDraftReply(toEmail, toName, subject, body, threadId, messageId_original) {
  try {
    const email = [
      `To: ${toEmail}`,
      `Subject: Re: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `In-Reply-To: ${messageId_original}`,
      `References: ${messageId_original}`,
      "",
      body,
    ].join("\n");

    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodedEmail,
          threadId: threadId,
        },
      },
    });

    console.log(`✅ Draft reply saved for ${toEmail}`);
    console.log(`📝 Subject: Re: ${subject}\n`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving draft:`, error.message);
    return false;
  }
}

async function markAsRead(messageId) {
  try {
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        removeLabelIds: ["UNREAD"],
      },
    });
  } catch (error) {
    console.error("Error marking as read:", error.message);
  }
}

async function processCateringEmails() {
  console.log("🧡 MR PAPA EMAIL AUTOMATION - STARTING\n");
  console.log("═══════════════════════════════════════\n");
  console.log("🇦🇺 Mode: VERCEL DEPLOYMENT\n");
  console.log("═══════════════════════════════════════\n");

  const unrepliedEmails = await getUnrepliedEmails();

  if (unrepliedEmails.length === 0) {
    console.log("✨ No unread catering enquiries found. All good!\n");
    return { processed: 0, message: "No new emails" };
  }

  console.log(`Found ${unrepliedEmails.length} unread enquiries\n`);

  let processedCount = 0;

  for (let i = 0; i < unrepliedEmails.length; i++) {
    const emailId = unrepliedEmails[i].id;
    const emailContent = await getEmailContent(emailId);

    if (!emailContent) continue;

    console.log(`[${i + 1}/${unrepliedEmails.length}] Processing email`);
    console.log(`From: ${emailContent.name} <${emailContent.from}>`);
    console.log(`Subject: ${emailContent.subject}\n`);

    console.log("📖 Reading full conversation history...");
    const threadHistory = await getThreadHistory(emailContent.threadId);

    const response = await generateMrPapaResponse(
      emailContent.name,
      emailContent.body,
      emailContent.subject,
      threadHistory
    );

    if (response) {
      const saved = await saveDraftReply(
        emailContent.from,
        emailContent.name,
        emailContent.subject,
        response,
        emailContent.threadId,
        emailContent.messageId_original
      );

      if (saved) {
        await markAsRead(emailId);
        processedCount++;
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("═══════════════════════════════════════");
  console.log(`✅ Processed ${processedCount} emails!\n`);

  return { processed: processedCount, success: true };
}

// ENDPOINT PARA VERCEL
module.exports = async (req, res) => {
  try {
    const result = await processCateringEmails();
    res.status(200).json(result);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
};