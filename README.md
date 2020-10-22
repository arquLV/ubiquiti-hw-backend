# Ubiquiti Home Assignment

By Arturs Kurzemnieks <arturs.kurzemnieks@gmail.com>

## User stories implemented

- I as a user can create to-do items, such as a grocery list
- I as another user can collaborate in real-time with user - so that we can (for example) edit our family shopping-list together
- I as a user can mark to-do items as “done” - so that I can avoid clutter and focus on things that are still pending
- I as a user can filter the to-do list and view items that were marked as done - so that I can retrospect on my prior progress
- I as a user can see the cursor and/or selection of another-user as he selects/types when
he is editing text - so that we can discuss focused words during our online call


## Notes

A few additional user stories were planned but left half-way there as time was short.
- Multiple to-do lists can be created, designed that way from the beginning, didn't implement unique URLs. 
- Data is stored in an object on the server-side posing as fake "database". Could quite easily add Mongo or something to keep the todos persisted for real after server restarts.
- Freeze/unfreeze was also planned along with multiple to-do lists, user system already in place. Need to add owner ID to each todo list and some freezed/accessible state.

If there are any questions, please feel free to ask. I operated on the mindset that for a task
like this it's better to do things from scratch and leave some rough edges than to import lots of ready-made stuff.
