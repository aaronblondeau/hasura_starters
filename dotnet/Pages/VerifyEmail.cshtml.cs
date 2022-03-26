using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace HasuraStarter.Pages
{
    public class VerifyEmailModel : PageModel
    {
        [BindProperty(SupportsGet = true)]
        public string Token { get; set; } = "";

        public bool Success { get; set; } = true;

        public async Task OnGetAsync()
        {
            try
            {
                var user = await UserGraphQL.GetUserByEmailVerifyToken(Token);
                await UserGraphQL.VerifyUser(user.id);
                Success = true;
            }
            catch (Exception)
            {
                Success = false;
            }
        }
    }
}
