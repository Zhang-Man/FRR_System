import sys, os
sys.path.insert(0, 'backend')
os.environ['DB_PATH'] = 'backend/data.db'
from models import get_db
db = get_db()

cats = db.execute('SELECT category, COUNT(*) as cnt FROM tickets GROUP BY category ORDER BY cnt DESC').fetchall()
print('Category distribution:')
for c in cats: print(f'  {c["category"]}: {c["cnt"]}')

print()
stu = db.execute("""SELECT u.name, COUNT(*) as cnt FROM tickets t
    JOIN users u ON u.user_id=t.assignee_id
    WHERE t.status='resolved' GROUP BY t.assignee_id ORDER BY cnt DESC""").fetchall()
print('handlers by resolved count:')
for s in stu: print(f'  {s["name"]}: {s["cnt"]}')

print()
months = db.execute("SELECT substr(created_at,1,7) as m, COUNT(*) as cnt FROM tickets GROUP BY m ORDER BY m").fetchall()
print('Month distribution:')
for m in months: print(f'  {m["m"]}: {m["cnt"]}')

status = db.execute("SELECT status, COUNT(*) as cnt FROM tickets GROUP BY status").fetchall()
print()
print('Status distribution:')
for s in status: print(f'  {s["status"]}: {s["cnt"]}')

db.close()
