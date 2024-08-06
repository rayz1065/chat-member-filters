import { Bot, Context } from 'https://lib.deno.dev/x/grammy@v1/mod.ts';
import { DEFAULT_UPDATE_TYPES } from 'https://lib.deno.dev/x/grammy@v1/bot.ts';
import {
  bold,
  code,
  fmt,
  hydrateReply,
  ParseModeFlavor,
} from 'https://deno.land/x/grammy_parse_mode@1.10.0/mod.ts';
import { chatMemberFilter } from '../src/mod.ts';

type MyContext = ParseModeFlavor<Context>;

const botToken = Deno.env.get('BOT_TOKEN');
if (!botToken) {
  throw new Error('Please provide BOT_TOKEN in the environment');
}
const bot = new Bot<MyContext>(botToken);
bot.use(hydrateReply);

bot.on('chat_member', (ctx, next) => {
  // ran on all updates of type chat_member
  // useful for common operations, like updating the database
  const {
    old_chat_member: { status: oldStatus },
    new_chat_member: { user, status },
    from,
    chat,
  } = ctx.chatMember;
  console.log(
    `In chat ${chat.id} user ${from.id} changed status of ${user.id}:`,
    `${oldStatus} -> ${status}`,
  );
  return next();
});

const groups = bot.chatType(['group', 'supergroup']);

// in <-> out transitions and bans

groups.filter(chatMemberFilter('out', 'in'), async (ctx, next) => {
  const {
    from,
    new_chat_member: { user, status },
  } = ctx.chatMember;
  await ctx.replyFmt(
    fmt`${bold(from.first_name)} added ${bold(user.first_name)} as ${
      code(status)
    }`,
  );
  // adding next is unnecessary, it is done here as a way to show that there is
  // no overlap between transitions (as a result only one handler is called).
  return next();
});

groups.filter(chatMemberFilter('in', 'left'), async (ctx, next) => {
  const {
    new_chat_member: { user },
  } = ctx.chatMember;
  await ctx.replyFmt(fmt`${bold(user.first_name)} left`);
  return next();
});

groups.filter(chatMemberFilter(['in', 'left'], 'kicked'), async (ctx, next) => {
  const {
    from,
    new_chat_member: { user },
  } = ctx.chatMember;
  await ctx.replyFmt(
    fmt`${bold(user.first_name)} was banned by ${bold(from.first_name)}`,
  );
  return next();
});

groups.filter(chatMemberFilter('kicked', 'left'), async (ctx, next) => {
  const {
    from,
    new_chat_member: { user },
  } = ctx.chatMember;
  await ctx.replyFmt(
    fmt`${bold(user.first_name)} was unbanned by ${bold(from.first_name)}`,
  );
  return next();
});

// member restricted or pardoned

groups.filter(chatMemberFilter('in', 'restricted'), async (ctx, next) => {
  const {
    from,
    new_chat_member: { user },
    old_chat_member: { status: oldStatus },
  } = ctx.chatMember;
  await ctx.replyFmt(
    fmt`${bold(user.first_name)} ${
      oldStatus !== 'restricted'
        ? 'was restricted'
        : 'restrictions were updated'
    } by ${bold(from.first_name)}`,
  );
  return next();
});

groups.filter(chatMemberFilter('restricted', 'member'), async (ctx, next) => {
  const {
    from,
    new_chat_member: { user },
  } = ctx.chatMember;
  await ctx.replyFmt(
    fmt`${bold(user.first_name)} was pardoned by ${bold(from.first_name)}`,
  );
  return next();
});

// promotions and demotions

groups.filter(chatMemberFilter('admin', 'member'), async (ctx, next) => {
  const {
    from,
    new_chat_member: { user },
  } = ctx.chatMember;
  await ctx.replyFmt(
    fmt`${bold(user.first_name)} was demoted by ${bold(from.first_name)}`,
  );
  return next();
});

groups.filter(chatMemberFilter('in', 'admin'), async (ctx, next) => {
  const {
    from,
    new_chat_member: { user },
    old_chat_member: { status: oldStatus },
  } = ctx.chatMember;
  await ctx.replyFmt(
    fmt`${bold(user.first_name)} ${
      oldStatus === 'administrator'
        ? 'permissions were updated'
        : 'was promoted'
    } by ${bold(from.first_name)}`,
  );
  return next();
});

bot.catch((error) => {
  console.error('Error:', error);
});

bot.start({
  allowed_updates: [...DEFAULT_UPDATE_TYPES, 'chat_member'],
  onStart: (me) => console.log('Listening to updates as', me.username),
});
