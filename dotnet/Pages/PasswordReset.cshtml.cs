using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Primitives;

namespace HasuraStarter.Pages
{
    public class PasswordResetModel : PageModel
    {
        public string Token { get; private set; } = "";
        public string Message { get; private set; } = "Want to reset password?";

        public async Task OnGetAsync()
        {
            await Task.Delay(200);
            if (Request.Query.TryGetValue("token", out StringValues token))
            {
                Token = token;
            }
        }

        public async Task<IActionResult> OnPostAsync()
        {
            Console.WriteLine("~~dbg HERE Post");
            Message = "You said something?";
            await Task.Delay(200);
            if (Request.Form.TryGetValue("password", out StringValues password))
            {
                Console.WriteLine("~~dbg Got Password " + password);
            }
            return Page();
            // return RedirectToPage("./Index");
        }
    }
}
